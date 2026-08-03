GRANT USAGE ON SCHEMA auth TO sandbox_exec;
GRANT SELECT ON TABLE auth.users TO sandbox_exec;
DROP TABLE IF EXISTS public.profiles CASCADE;