-- Product analytics events used to diagnose onboarding, grading, and checkout funnels.
-- The application writes through /api/events with the service role key.

CREATE TABLE IF NOT EXISTS public.app_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_name TEXT NOT NULL CHECK (event_name ~ '^[a-z0-9_]{1,80}$'),
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_events_event_name_created_at
ON public.app_events(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_events_user_id_created_at
ON public.app_events(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view app events" ON public.app_events;
CREATE POLICY "Admins can view app events" ON public.app_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.user_profiles
            WHERE id = auth.uid()
              AND role = 'admin'
        )
    );
