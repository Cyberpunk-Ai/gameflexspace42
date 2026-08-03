CREATE TABLE public.status_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.user_statuses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_saves TO authenticated;
GRANT ALL ON public.status_saves TO service_role;
ALTER TABLE public.status_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saves_own" ON public.status_saves FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_name text NOT NULL,
  properties jsonb,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.analytics_events TO authenticated, anon;
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_insert_any" ON public.analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_admin_read" ON public.analytics_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE VIEW public.user_followers WITH (security_invoker = true) AS
  SELECT id, follower_id, following_id, created_at FROM public.user_follows;
GRANT SELECT ON public.user_followers TO authenticated, anon;
GRANT ALL ON public.user_followers TO service_role;