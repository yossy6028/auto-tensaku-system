-- Read the current user's admin flag without recursively entering the profile
-- SELECT policy. The historical policy queried user_profiles from itself,
-- making even initial profile, plan, and settings reads fail on a fresh database.
-- Keep the existing visibility: own profile, or all profiles for an admin.
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
GRANT UPDATE (display_name, stripe_customer_id, updated_at)
    ON public.user_profiles TO authenticated;
