-- PREPARED ONLY: run manually only after the migration is approved and applied.
-- This creates a non-owner runtime login without a password. Set its password
-- through the Supabase Dashboard; never put the password in this file.
-- Do not grant this role membership in postgres, authenticated, service_role,
-- or any role with BYPASSRLS, CREATE, CREATEDB, or CREATEROLE.
CREATE ROLE campusconnect_runtime
  LOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOBYPASSRLS;

GRANT CONNECT ON DATABASE postgres TO campusconnect_runtime;
GRANT USAGE ON SCHEMA public TO campusconnect_runtime;

GRANT USAGE ON TYPE
  public.user_role,
  public.account_status,
  public.complaint_status,
  public.intake_session_status,
  public.conversation_speaker,
  public.severity,
  public.urgency,
  public.ai_review_status
TO campusconnect_runtime;

GRANT SELECT, INSERT ON TABLE public.user_profiles TO campusconnect_runtime;
GRANT UPDATE (display_name, account_status, disabled_at, updated_at)
  ON TABLE public.user_profiles TO campusconnect_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public.departments TO campusconnect_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public.complaint_categories TO campusconnect_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public.complaints TO campusconnect_runtime;
GRANT SELECT ON TABLE public.complaint_status_history TO campusconnect_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_intake_sessions TO campusconnect_runtime;
GRANT SELECT, INSERT ON TABLE public.conversation_messages TO campusconnect_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_assessments TO campusconnect_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public.student_responses TO campusconnect_runtime;
GRANT SELECT ON TABLE public.audit_logs TO campusconnect_runtime;

GRANT EXECUTE ON FUNCTION
  public.app_user_id(),
  public.app_user_role(),
  public.app_is_admin()
TO campusconnect_runtime;

-- The runtime role is not the table owner and has no DELETE or TRUNCATE grants.
-- The server must verify the Supabase user first, then set the claim inside each
-- Prisma transaction before any RLS-protected query:
-- SELECT set_config('request.jwt.claim.sub', $1, true);
