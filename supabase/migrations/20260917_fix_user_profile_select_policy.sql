-- Preserve databases that already use a non-recursive, hardened profile policy.
-- The historical local bootstrap has a recursive self-query and broad UPDATE
-- grants; production can already use private.is_admin() and SELECT-only access.
-- Never replace an existing hardened policy or add write grants to that database.
DO $migration$
DECLARE
    profile_select_expression TEXT;
    had_legacy_table_update BOOLEAN;
BEGIN
    SELECT qual INTO profile_select_expression
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_profiles'
      AND policyname = 'user_profiles_select' AND cmd = 'SELECT';

    IF profile_select_expression IS NULL THEN
        RAISE EXCEPTION 'Expected user_profiles_select policy is missing; manual review required';
    END IF;
    IF profile_select_expression !~ 'FROM[[:space:]]+(public\.)?user_profiles([[:space:]]|\))' THEN
        RAISE NOTICE 'Preserving existing non-recursive profile policy and grants';
        RETURN;
    END IF;

    had_legacy_table_update := has_table_privilege(
        'authenticated', 'public.user_profiles', 'UPDATE'
    );

-- Read the current user's admin flag without recursively entering the profile
-- SELECT policy. The historical policy queried user_profiles from itself,
-- making even initial profile, plan, and settings reads fail on a fresh database.
-- Keep the existing visibility: own profile, or all profiles for an admin.
EXECUTE $definition$
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;
$definition$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "user_profiles_select" ON public.user_profiles;
CREATE POLICY "user_profiles_select" ON public.user_profiles
    FOR SELECT
    USING (id = auth.uid() OR public.is_current_user_admin());

-- Once SELECT works, the historical self-update policy would also let an
-- ordinary user promote their own role or reset their free-trial quota.
-- Provisioning is already done by handle_new_user / ensure-profile (service role).
-- Browser updates retain only presentation fields and the Stripe customer cache
-- currently written by the authenticated checkout route. Usage RPCs run as their
-- SECURITY DEFINER owner; trusted service-role writes retain their existing grant.
REVOKE INSERT, UPDATE ON public.user_profiles FROM anon, authenticated;
IF had_legacy_table_update THEN
    GRANT UPDATE (display_name, stripe_customer_id, updated_at)
        ON public.user_profiles TO authenticated;
END IF;

END;
$migration$;
