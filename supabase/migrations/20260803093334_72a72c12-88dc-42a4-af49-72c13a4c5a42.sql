DO $$
DECLARE s text;
BEGIN
  SELECT string_agg(sql, chr(10) ORDER BY id) INTO s FROM public._bootstrap_sql;
  EXECUTE s;
END $$;
DROP TABLE public._bootstrap_sql;
ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;