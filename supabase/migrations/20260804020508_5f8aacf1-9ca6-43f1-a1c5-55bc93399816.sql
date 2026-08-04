-- crest colour
ALTER TABLE public.squads ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '265 85% 62%';

-- captain OR co-captain
CREATE OR REPLACE FUNCTION public.is_squad_leader(_squad_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.squads WHERE id = _squad_id AND captain_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = _squad_id AND user_id = _user_id AND role IN ('captain','co_captain'));
$$;

-- ---------- squad messages ----------
CREATE TABLE IF NOT EXISTS public.squad_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id uuid,
  content text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_messages TO authenticated;
GRANT ALL ON public.squad_messages TO service_role;
ALTER TABLE public.squad_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "squad_messages_read_members" ON public.squad_messages FOR SELECT TO authenticated
  USING (public.is_squad_member(squad_id, auth.uid()));
CREATE POLICY "squad_messages_insert_members" ON public.squad_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_squad_member(squad_id, auth.uid()) AND (user_id = auth.uid() OR is_system));
CREATE POLICY "squad_messages_update_members" ON public.squad_messages FOR UPDATE TO authenticated
  USING (public.is_squad_member(squad_id, auth.uid())) WITH CHECK (public.is_squad_member(squad_id, auth.uid()));
CREATE POLICY "squad_messages_delete_author_or_leader" ON public.squad_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_squad_leader(squad_id, auth.uid()));
CREATE INDEX IF NOT EXISTS squad_messages_squad_idx ON public.squad_messages(squad_id, created_at);

-- ---------- squad events ----------
CREATE TABLE IF NOT EXISTS public.squad_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  title text NOT NULL,
  game text,
  type text NOT NULL DEFAULT 'tournament',
  starts_at timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_events TO authenticated;
GRANT ALL ON public.squad_events TO service_role;
ALTER TABLE public.squad_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "squad_events_read_members" ON public.squad_events FOR SELECT TO authenticated
  USING (public.is_squad_member(squad_id, auth.uid()));
CREATE POLICY "squad_events_insert_members" ON public.squad_events FOR INSERT TO authenticated
  WITH CHECK (public.is_squad_member(squad_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "squad_events_update_owner_or_leader" ON public.squad_events FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_squad_leader(squad_id, auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_squad_leader(squad_id, auth.uid()));
CREATE POLICY "squad_events_delete_owner_or_leader" ON public.squad_events FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_squad_leader(squad_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.squad_event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.squad_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'in',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_event_rsvps TO authenticated;
GRANT ALL ON public.squad_event_rsvps TO service_role;
ALTER TABLE public.squad_event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "squad_rsvps_read_members" ON public.squad_event_rsvps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.squad_events e WHERE e.id = event_id AND public.is_squad_member(e.squad_id, auth.uid())));
CREATE POLICY "squad_rsvps_write_self" ON public.squad_event_rsvps FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.squad_events e WHERE e.id = event_id AND public.is_squad_member(e.squad_id, auth.uid())));
CREATE POLICY "squad_rsvps_update_self" ON public.squad_event_rsvps FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "squad_rsvps_delete_self" ON public.squad_event_rsvps FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------- join requests ----------
CREATE TABLE IF NOT EXISTS public.squad_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id uuid NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  responded_by uuid,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS squad_join_requests_pending_uniq
  ON public.squad_join_requests(squad_id, user_id) WHERE status = 'pending';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_join_requests TO authenticated;
GRANT ALL ON public.squad_join_requests TO service_role;
ALTER TABLE public.squad_join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "join_requests_read" ON public.squad_join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_squad_leader(squad_id, auth.uid()));
CREATE POLICY "join_requests_insert_self" ON public.squad_join_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.squads s WHERE s.id = squad_id AND s.is_public));
CREATE POLICY "join_requests_update_leader" ON public.squad_join_requests FOR UPDATE TO authenticated
  USING (public.is_squad_leader(squad_id, auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_squad_leader(squad_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "join_requests_delete_self" ON public.squad_join_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_squad_leader(squad_id, auth.uid()));

CREATE TRIGGER squad_join_requests_updated_at BEFORE UPDATE ON public.squad_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- leaders may also add an approved member
DROP POLICY IF EXISTS squad_members_join_self ON public.squad_members;
CREATE POLICY "squad_members_join_self" ON public.squad_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_squad_leader(squad_id, auth.uid()));
DROP POLICY IF EXISTS squad_members_update_captain ON public.squad_members;
CREATE POLICY "squad_members_update_captain" ON public.squad_members FOR UPDATE TO authenticated
  USING (public.is_squad_leader(squad_id, auth.uid())) WITH CHECK (public.is_squad_leader(squad_id, auth.uid()));
DROP POLICY IF EXISTS squad_members_leave ON public.squad_members;
CREATE POLICY "squad_members_leave" ON public.squad_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.is_squad_leader(squad_id, auth.uid()));
DROP POLICY IF EXISTS invites_create_captain ON public.squad_invites;
CREATE POLICY "invites_create_captain" ON public.squad_invites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = inviter_id AND public.is_squad_leader(squad_id, auth.uid()));

-- notify leaders of new join requests + notify requester of decision
CREATE OR REPLACE FUNCTION public.notify_squad_join_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sname text; uname text;
BEGIN
  SELECT name INTO sname FROM public.squads WHERE id = NEW.squad_id;
  SELECT username INTO uname FROM public.profiles WHERE user_id = NEW.user_id;
  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  SELECT m.user_id, 'squad', 'Squad join request',
    COALESCE(uname,'A player') || ' wants to join ' || COALESCE(sname,'your squad'), '/teams/' || NEW.squad_id
  FROM public.squad_members m
  WHERE m.squad_id = NEW.squad_id AND m.role IN ('captain','co_captain');
  RETURN NEW;
END; $$;
CREATE TRIGGER squad_join_request_created AFTER INSERT ON public.squad_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_squad_join_request();

CREATE OR REPLACE FUNCTION public.handle_squad_join_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sname text;
BEGIN
  IF NEW.status <> OLD.status AND NEW.status IN ('approved','rejected') THEN
    NEW.responded_at = now();
    SELECT name INTO sname FROM public.squads WHERE id = NEW.squad_id;
    IF NEW.status = 'approved' THEN
      INSERT INTO public.squad_members (squad_id, user_id, role)
      VALUES (NEW.squad_id, NEW.user_id, 'player') ON CONFLICT (squad_id, user_id) DO NOTHING;
    END IF;
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (NEW.user_id, 'squad',
      CASE WHEN NEW.status = 'approved' THEN 'Join request approved' ELSE 'Join request declined' END,
      COALESCE(sname,'The squad') || ': your request was ' || NEW.status,
      '/teams/' || NEW.squad_id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER squad_join_response BEFORE UPDATE ON public.squad_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_squad_join_response();

ALTER TABLE public.squad_messages REPLICA IDENTITY FULL;
ALTER TABLE public.squad_join_requests REPLICA IDENTITY FULL;
ALTER TABLE public.squad_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_join_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_events;