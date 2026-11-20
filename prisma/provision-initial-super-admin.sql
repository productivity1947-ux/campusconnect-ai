-- OPERATOR-ONLY BOOTSTRAP; never expose or invoke this through an application route.
-- Replace both UUIDs with independently verified existing profile IDs.
-- The target must be an active student; the actor must be a different active admin.
-- Run only from a trusted Supabase SQL Editor/administrative session after the
-- migration is approved and applied. The role-change trigger writes an audit row.
BEGIN;

SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);

LOCK TABLE public.user_profiles IN EXCLUSIVE MODE;

DO $$
DECLARE
  target_user_id CONSTANT uuid := '00000000-0000-0000-0000-000000000002';
  actor_id uuid := public.app_user_id();
  updated_rows integer;
BEGIN
  IF actor_id IS NULL OR actor_id = target_user_id THEN
    RAISE EXCEPTION 'Bootstrap requires an independent operator profile.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = actor_id
      AND account_status = 'ACTIVE'::public.account_status
      AND disabled_at IS NULL
      AND role = 'ADMIN'::public.user_role
  ) THEN
    RAISE EXCEPTION 'The operator profile must be an active ADMIN.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE role = 'SUPER_ADMIN'::public.user_role
  ) THEN
    RAISE EXCEPTION 'A SUPER_ADMIN is already provisioned.'
      USING ERRCODE = '55000';
  END IF;

  UPDATE public.user_profiles
  SET role = 'SUPER_ADMIN'::public.user_role
  WHERE id = target_user_id
    AND role = 'STUDENT'::public.user_role
    AND account_status = 'ACTIVE'::public.account_status
    AND disabled_at IS NULL;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'The verified target must be exactly one active student.'
      USING ERRCODE = '23514';
  END IF;
END
$$;

COMMIT;
