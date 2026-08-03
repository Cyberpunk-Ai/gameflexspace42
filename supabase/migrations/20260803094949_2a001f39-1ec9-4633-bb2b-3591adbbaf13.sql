DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['activity_feed','conversations','leaderboard_stats','matches','messages','registrations','rewards','status_comments','status_likes','tournaments','user_follows','user_statuses','payments']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;