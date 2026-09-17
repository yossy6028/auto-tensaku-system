-- Local fixture only. All synthetic rows are rolled back even on success.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('test.user_id', gen_random_uuid()::text, true);
SELECT set_config('test.other_id', gen_random_uuid()::text, true);
SELECT set_config('test.admin_id', gen_random_uuid()::text, true);
INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT current_setting(setting)::uuid,
       current_setting(setting) || '@example.test', '{}'::jsonb
FROM unnest(ARRAY['test.user_id', 'test.other_id', 'test.admin_id']) AS setting;
UPDATE public.user_profiles SET role = 'admin'
WHERE id = current_setting('test.admin_id')::uuid;

SET LOCAL ROLE anon;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.user_profiles) THEN
    RAISE EXCEPTION 'Anonymous profile access must be denied';
  END IF;
  IF public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Anonymous user cannot be admin';
  END IF;
  PERFORM 1 FROM public.pricing_plans;
  PERFORM 1 FROM public.system_settings;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', current_setting('test.user_id'), true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.user_profiles) <> 1 THEN
    RAISE EXCEPTION 'A user must see exactly their own profile';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_profiles
             WHERE id = current_setting('test.other_id')::uuid) THEN
    RAISE EXCEPTION 'Other user profile must not be visible';
  END IF;
  IF public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Ordinary user cannot be admin';
  END IF;
END $$;

DO $$ BEGIN
  BEGIN
    UPDATE public.user_profiles SET role = 'admin' WHERE id = auth.uid();
    RAISE EXCEPTION 'Self-promotion must be denied';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.user_profiles SET free_trial_usage_count = 0 WHERE id = auth.uid();
    RAISE EXCEPTION 'Direct trial reset must be denied';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.user_profiles (id, role) VALUES (auth.uid(), 'admin');
    RAISE EXCEPTION 'Direct profile provisioning must be denied';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.user_profiles SET display_name = 'Local test' WHERE id = auth.uid();
  IF NOT (SELECT success FROM public.reserve_usage(auth.uid(), 1)) THEN
    RAISE EXCEPTION 'Authorized usage reservation must remain available';
  END IF;
  IF (SELECT free_trial_usage_count FROM public.user_profiles WHERE id = auth.uid()) <> 1 THEN
    RAISE EXCEPTION 'Usage RPC must still update the trial counter';
  END IF;
  PERFORM public.release_usage(auth.uid(), 1);
  IF (SELECT free_trial_usage_count FROM public.user_profiles WHERE id = auth.uid()) <> 0 THEN
    RAISE EXCEPTION 'Usage release must still restore the counter';
  END IF;
  IF NOT has_column_privilege(current_user, 'public.user_profiles', 'stripe_customer_id', 'UPDATE') THEN
    RAISE EXCEPTION 'Existing checkout cache update must remain available';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', current_setting('test.admin_id'), true);
DO $$ BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Admin flag must be preserved';
  END IF;
  IF (SELECT count(*) FROM public.user_profiles
      WHERE id IN (current_setting('test.user_id')::uuid,
                   current_setting('test.other_id')::uuid,
                   current_setting('test.admin_id')::uuid)) <> 3 THEN
    RAISE EXCEPTION 'Admin must retain visibility of the three fixtures';
  END IF;
END $$;
ROLLBACK;
