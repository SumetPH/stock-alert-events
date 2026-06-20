ALTER TABLE public.stock_alert_events ENABLE ROW LEVEL SECURITY;

-- This table is managed exclusively by the backend with the service role, which
-- bypasses RLS. Keep Supabase client roles from reading or mutating alert events.
CREATE POLICY "Deny client access to stock alert events"
ON public.stock_alert_events
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
