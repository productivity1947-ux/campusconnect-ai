ALTER TABLE public.complaints
  ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.log_complaint_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id uuid;
BEGIN
  actor_id := public.app_user_id();
  IF NEW.is_anonymous
     AND public.app_user_role() = 'STUDENT'::public.user_role THEN
    actor_id := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.complaint_status_history
      (complaint_id, from_status, to_status, changed_by_id, visible_to_student)
    VALUES (NEW.id, NULL, NEW.status, actor_id, true);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.complaint_status_history
      (complaint_id, from_status, to_status, changed_by_id, visible_to_student)
    VALUES (NEW.id, OLD.status, NEW.status, actor_id, true);
  END IF;

  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.guard_student_response_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  author_role public.user_role;
  author_status public.account_status;
  author_disabled_at timestamptz;
  actor_id uuid;
  complaint_owner_id uuid;
  complaint_status public.complaint_status;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.complaint_id IS DISTINCT FROM OLD.complaint_id
       OR NEW.author_id IS DISTINCT FROM OLD.author_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Student-visible response identity is immutable.'
        USING ERRCODE = '55000';
    END IF;

    IF NEW.body IS DISTINCT FROM OLD.body THEN
      NEW.edited_at = CURRENT_TIMESTAMP;
    END IF;
  ELSE
    SELECT role, account_status, disabled_at
    INTO author_role, author_status, author_disabled_at
    FROM public.user_profiles
    WHERE id = NEW.author_id;

    IF author_role IS NULL
       OR author_status IS DISTINCT FROM 'ACTIVE'::public.account_status
       OR author_disabled_at IS NOT NULL THEN
      RAISE EXCEPTION 'A response must be authored by an active account.'
        USING ERRCODE = '42501';
    END IF;

    actor_id := public.app_user_id();
    IF actor_id IS DISTINCT FROM NEW.author_id THEN
      RAISE EXCEPTION 'The response author must match the authenticated actor.'
        USING ERRCODE = '42501';
    END IF;

    IF author_role IN ('ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role) THEN
      NULL;
    ELSIF author_role = 'STUDENT'::public.user_role THEN
      SELECT student_id, status
      INTO complaint_owner_id, complaint_status
      FROM public.complaints
      WHERE id = NEW.complaint_id;

      IF complaint_owner_id IS DISTINCT FROM NEW.author_id THEN
        RAISE EXCEPTION 'A student may only respond to their own grievance.'
          USING ERRCODE = '42501';
      END IF;
      IF complaint_status IN (
        'CLOSED'::public.complaint_status,
        'REJECTED'::public.complaint_status
      ) THEN
        RAISE EXCEPTION 'This grievance no longer accepts student responses.'
          USING ERRCODE = '42501';
      END IF;
    ELSE
      RAISE EXCEPTION 'A response must be authored by an active student or administrator.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF length(btrim(NEW.body)) = 0 THEN
    RAISE EXCEPTION 'Student-visible response text cannot be blank.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE POLICY student_responses_student_insert ON public.student_responses
FOR INSERT WITH CHECK (
  author_id = public.app_user_id()
  AND public.app_user_role() = 'STUDENT'::public.user_role
  AND EXISTS (
    SELECT 1
    FROM public.complaints AS complaint
    WHERE complaint.id = complaint_id
      AND complaint.student_id = public.app_user_id()
      AND complaint.status NOT IN (
        'CLOSED'::public.complaint_status,
        'REJECTED'::public.complaint_status
      )
  )
);

CREATE OR REPLACE FUNCTION public.audit_student_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  audit_actor_id uuid;
  response_author_role public.user_role;
  complaint_is_anonymous boolean;
BEGIN
  audit_actor_id := NEW.author_id;
  SELECT role
  INTO response_author_role
  FROM public.user_profiles
  WHERE id = NEW.author_id;
  SELECT is_anonymous
  INTO complaint_is_anonymous
  FROM public.complaints
  WHERE id = NEW.complaint_id;

  IF complaint_is_anonymous
     AND response_author_role = 'STUDENT'::public.user_role THEN
    audit_actor_id := NULL;
  END IF;

  INSERT INTO public.audit_logs
    (actor_id, complaint_id, entity_type, entity_id, action, metadata)
  VALUES (
    audit_actor_id,
    NEW.complaint_id,
    'student_response',
    NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'RESPONSE_CREATED' ELSE 'RESPONSE_EDITED' END,
    jsonb_build_object('edited_at', NEW.edited_at)
  );

  RETURN NEW;
END
$$;
