-- Create Stripe webhook event log used for idempotency.
-- The webhook route writes with the Supabase service role key.

CREATE TABLE IF NOT EXISTS public.stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    data JSONB NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id
ON public.stripe_events(event_id);

CREATE INDEX IF NOT EXISTS idx_stripe_events_event_type
ON public.stripe_events(event_type);

CREATE INDEX IF NOT EXISTS idx_stripe_events_created_at
ON public.stripe_events(created_at);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view stripe events" ON public.stripe_events;
CREATE POLICY "Admins can view stripe events" ON public.stripe_events
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
