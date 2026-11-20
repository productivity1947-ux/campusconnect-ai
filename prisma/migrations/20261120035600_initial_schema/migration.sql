-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('STUDENT', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "complaint_status" AS ENUM ('SUBMITTED', 'TRIAGED', 'IN_PROGRESS', 'WAITING_FOR_STUDENT', 'RESOLVED', 'CLOSED', 'REOPENED', 'REJECTED');

-- CreateEnum
CREATE TYPE "intake_session_status" AS ENUM ('ACTIVE', 'SUBMITTED', 'ABANDONED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "conversation_speaker" AS ENUM ('STUDENT', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "urgency" AS ENUM ('ROUTINE', 'SOON', 'URGENT', 'IMMEDIATE');

-- CreateEnum
CREATE TYPE "ai_review_status" AS ENUM ('PENDING', 'ACCEPTED', 'CORRECTED', 'REJECTED');

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "display_name" VARCHAR(150),
    "role" "user_role" NOT NULL DEFAULT 'STUDENT',
    "account_status" "account_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabled_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "department_id" UUID,
    "name" VARCHAR(140) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "intake_session_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "complaint_status" NOT NULL DEFAULT 'SUBMITTED',
    "category_id" UUID,
    "severity" "severity",
    "urgency" "urgency",
    "triaged_by_id" UUID,
    "triaged_at" TIMESTAMPTZ(6),
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "complaint_id" UUID NOT NULL,
    "from_status" "complaint_status",
    "to_status" "complaint_status" NOT NULL,
    "changed_by_id" UUID,
    "visible_to_student" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_intake_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "status" "intake_session_status" NOT NULL DEFAULT 'ACTIVE',
    "model_name" VARCHAR(160),
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_intake_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "speaker" "conversation_speaker" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "redacted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_assessments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "complaint_id" UUID NOT NULL,
    "model_provider" VARCHAR(80) NOT NULL,
    "model_name" VARCHAR(160) NOT NULL,
    "model_version" VARCHAR(100),
    "prompt_version" VARCHAR(100),
    "recommended_category_id" UUID,
    "recommended_severity" "severity",
    "recommended_urgency" "urgency",
    "confidence" DECIMAL(5,4),
    "summary" TEXT,
    "rationale" TEXT,
    "review_status" "ai_review_status" NOT NULL DEFAULT 'PENDING',
    "corrected_category_id" UUID,
    "corrected_severity" "severity",
    "corrected_urgency" "urgency",
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewer_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_responses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "complaint_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "edited_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "complaint_id" UUID,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_email_key" ON "user_profiles"("email");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_slug_key" ON "departments"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_categories_slug_key" ON "complaint_categories"("slug");

-- CreateIndex
CREATE INDEX "complaint_categories_department_id_is_active_idx" ON "complaint_categories"("department_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_intake_session_id_key" ON "complaints"("intake_session_id");

-- CreateIndex
CREATE INDEX "complaints_student_id_created_at_idx" ON "complaints"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "complaints_status_created_at_idx" ON "complaints"("status", "created_at");

-- CreateIndex
CREATE INDEX "complaints_category_id_status_idx" ON "complaints"("category_id", "status");

-- CreateIndex
CREATE INDEX "complaints_severity_urgency_status_idx" ON "complaints"("severity", "urgency", "status");

-- CreateIndex
CREATE INDEX "complaint_status_history_complaint_id_created_at_idx" ON "complaint_status_history"("complaint_id", "created_at");

-- CreateIndex
CREATE INDEX "complaint_status_history_changed_by_id_created_at_idx" ON "complaint_status_history"("changed_by_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_intake_sessions_student_id_status_last_activity_at_idx" ON "ai_intake_sessions"("student_id", "status", "last_activity_at");

-- CreateIndex
CREATE INDEX "conversation_messages_session_id_created_at_idx" ON "conversation_messages"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_assessments_complaint_id_created_at_idx" ON "ai_assessments"("complaint_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_assessments_review_status_created_at_idx" ON "ai_assessments"("review_status", "created_at");

-- CreateIndex
CREATE INDEX "ai_assessments_recommended_category_id_idx" ON "ai_assessments"("recommended_category_id");

-- CreateIndex
CREATE INDEX "student_responses_complaint_id_created_at_idx" ON "student_responses"("complaint_id", "created_at");

-- CreateIndex
CREATE INDEX "student_responses_author_id_created_at_idx" ON "student_responses"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_complaint_id_created_at_idx" ON "audit_logs"("complaint_id", "created_at");

-- AddForeignKey
ALTER TABLE "complaint_categories" ADD CONSTRAINT "complaint_categories_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_intake_session_id_fkey" FOREIGN KEY ("intake_session_id") REFERENCES "ai_intake_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "complaint_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_triaged_by_id_fkey" FOREIGN KEY ("triaged_by_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_status_history" ADD CONSTRAINT "complaint_status_history_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_status_history" ADD CONSTRAINT "complaint_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_intake_sessions" ADD CONSTRAINT "ai_intake_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_intake_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_assessments" ADD CONSTRAINT "ai_assessments_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_assessments" ADD CONSTRAINT "ai_assessments_recommended_category_id_fkey" FOREIGN KEY ("recommended_category_id") REFERENCES "complaint_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_assessments" ADD CONSTRAINT "ai_assessments_corrected_category_id_fkey" FOREIGN KEY ("corrected_category_id") REFERENCES "complaint_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_assessments" ADD CONSTRAINT "ai_assessments_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_responses" ADD CONSTRAINT "student_responses_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_responses" ADD CONSTRAINT "student_responses_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE public.complaints
  ADD CONSTRAINT complaints_title_not_blank_check
    CHECK (length(btrim(title)) > 0),
  ADD CONSTRAINT complaints_description_not_blank_check
    CHECK (length(btrim(description)) > 0),
  ADD CONSTRAINT complaints_triaged_time_check
    CHECK (triaged_at IS NULL OR triaged_at >= submitted_at),
  ADD CONSTRAINT complaints_resolved_time_check
    CHECK (resolved_at IS NULL OR resolved_at >= submitted_at),
  ADD CONSTRAINT complaints_closed_time_check
    CHECK (closed_at IS NULL OR closed_at >= submitted_at);

ALTER TABLE public.ai_intake_sessions
  ADD CONSTRAINT ai_intake_sessions_time_order_check
    CHECK (
      last_activity_at >= started_at
      AND (ended_at IS NULL OR ended_at >= started_at)
    );

ALTER TABLE public.complaint_status_history
  ADD CONSTRAINT complaint_status_history_status_change_check
    CHECK (from_status IS NULL OR from_status <> to_status);

ALTER TABLE public.ai_assessments
  ADD CONSTRAINT ai_assessments_confidence_range_check
    CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  ADD CONSTRAINT ai_assessments_review_state_check
    CHECK (
      (
        review_status = 'PENDING'
        AND reviewed_by_id IS NULL
        AND reviewed_at IS NULL
        AND corrected_category_id IS NULL
        AND corrected_severity IS NULL
        AND corrected_urgency IS NULL
      )
      OR
      (
        review_status IN ('ACCEPTED', 'REJECTED')
        AND reviewed_by_id IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND corrected_category_id IS NULL
        AND corrected_severity IS NULL
        AND corrected_urgency IS NULL
      )
      OR
      (
        review_status = 'CORRECTED'
        AND reviewed_by_id IS NOT NULL
        AND reviewed_at IS NOT NULL
        AND (
          corrected_category_id IS NOT NULL
          OR corrected_severity IS NOT NULL
          OR corrected_urgency IS NOT NULL
        )
      )
    );

ALTER TABLE public.student_responses
  ADD CONSTRAINT student_responses_body_not_blank_check
    CHECK (length(btrim(body)) > 0);

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_entity_type_not_blank_check
    CHECK (length(btrim(entity_type)) > 0),
  ADD CONSTRAINT audit_logs_action_not_blank_check
    CHECK (length(btrim(action)) > 0);

CREATE OR REPLACE FUNCTION public.app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.app_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT profile.role
  FROM public.user_profiles AS profile
  WHERE profile.id = public.app_user_id()
    AND profile.account_status = 'ACTIVE'::public.account_status
    AND profile.disabled_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.app_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    public.app_user_role() IN ('ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.prevent_user_profile_id_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'User profile identity is immutable.'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER user_profiles_id_immutable
BEFORE UPDATE OF id ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_user_profile_id_change();

CREATE OR REPLACE FUNCTION public.guard_intake_session_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  owner_role public.user_role;
  owner_status public.account_status;
  owner_disabled_at timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.student_id IS DISTINCT FROM OLD.student_id THEN
    RAISE EXCEPTION 'Intake session ownership is immutable.'
      USING ERRCODE = '55000';
  END IF;

  SELECT role, account_status, disabled_at
  INTO owner_role, owner_status, owner_disabled_at
  FROM public.user_profiles
  WHERE id = NEW.student_id;

  IF owner_role IS DISTINCT FROM 'STUDENT'::public.user_role
     OR owner_status IS DISTINCT FROM 'ACTIVE'::public.account_status
     OR owner_disabled_at IS NOT NULL THEN
    RAISE EXCEPTION 'An intake session must belong to an active student.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER ai_intake_sessions_owner_guard
BEFORE INSERT OR UPDATE OF student_id ON public.ai_intake_sessions
FOR EACH ROW EXECUTE FUNCTION public.guard_intake_session_owner();

CREATE OR REPLACE FUNCTION public.guard_complaint_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  owner_role public.user_role;
  owner_status public.account_status;
  owner_disabled_at timestamptz;
BEGIN
  SELECT role, account_status, disabled_at
  INTO owner_role, owner_status, owner_disabled_at
  FROM public.user_profiles
  WHERE id = NEW.student_id;

  IF owner_role IS DISTINCT FROM 'STUDENT'::public.user_role
     OR owner_status IS DISTINCT FROM 'ACTIVE'::public.account_status
     OR owner_disabled_at IS NOT NULL THEN
    RAISE EXCEPTION 'A complaint must belong to an active student.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER complaints_owner_guard
BEFORE INSERT OR UPDATE OF student_id ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.guard_complaint_owner();

CREATE OR REPLACE FUNCTION public.guard_complaint_intake_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  intake_owner_id uuid;
BEGIN
  IF NEW.intake_session_id IS NOT NULL THEN
    SELECT student_id INTO intake_owner_id
    FROM public.ai_intake_sessions
    WHERE id = NEW.intake_session_id;

    IF intake_owner_id IS DISTINCT FROM NEW.student_id THEN
      RAISE EXCEPTION 'A complaint may only reference its owner''s intake session.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER complaints_intake_owner_guard
BEFORE INSERT OR UPDATE OF intake_session_id, student_id ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.guard_complaint_intake_owner();

CREATE OR REPLACE FUNCTION public.prevent_complaint_identity_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.intake_session_id IS DISTINCT FROM OLD.intake_session_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description THEN
    RAISE EXCEPTION 'Complaint identity, ownership, origin, and submitted content are immutable.'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER complaints_identity_immutable
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.prevent_complaint_identity_change();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END
$$;

CREATE TRIGGER user_profiles_set_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER departments_set_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER complaint_categories_set_updated_at
BEFORE UPDATE ON public.complaint_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER complaints_set_updated_at
BEFORE UPDATE ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER student_responses_set_updated_at
BEFORE UPDATE ON public.student_responses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.log_complaint_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.complaint_status_history
      (complaint_id, from_status, to_status, changed_by_id, visible_to_student)
    VALUES (NEW.id, NULL, NEW.status, public.app_user_id(), true);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.complaint_status_history
      (complaint_id, from_status, to_status, changed_by_id, visible_to_student)
    VALUES (NEW.id, OLD.status, NEW.status, public.app_user_id(), true);
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER complaints_log_status
AFTER INSERT OR UPDATE OF status ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.log_complaint_status();

CREATE OR REPLACE FUNCTION public.audit_complaint_classification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.category_id IS DISTINCT FROM OLD.category_id
     OR NEW.severity IS DISTINCT FROM OLD.severity
     OR NEW.urgency IS DISTINCT FROM OLD.urgency
     OR NEW.triaged_by_id IS DISTINCT FROM OLD.triaged_by_id
     OR NEW.triaged_at IS DISTINCT FROM OLD.triaged_at THEN
    INSERT INTO public.audit_logs
      (actor_id, complaint_id, entity_type, entity_id, action, metadata)
    VALUES (
      public.app_user_id(),
      NEW.id,
      'complaint',
      NEW.id,
      'CLASSIFICATION_UPDATED',
      jsonb_build_object(
        'from_category_id', OLD.category_id,
        'to_category_id', NEW.category_id,
        'from_severity', OLD.severity,
        'to_severity', NEW.severity,
        'from_urgency', OLD.urgency,
        'to_urgency', NEW.urgency,
        'from_triaged_by_id', OLD.triaged_by_id,
        'to_triaged_by_id', NEW.triaged_by_id,
        'from_triaged_at', OLD.triaged_at,
        'to_triaged_at', NEW.triaged_at
      )
    );
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER complaints_audit_classification_change
AFTER UPDATE OF category_id, severity, urgency, triaged_by_id, triaged_at
ON public.complaints
FOR EACH ROW EXECUTE FUNCTION public.audit_complaint_classification_change();

CREATE OR REPLACE FUNCTION public.prevent_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only.', TG_TABLE_NAME
    USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER complaint_status_history_append_only
BEFORE UPDATE OR DELETE ON public.complaint_status_history
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_mutation();
CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_mutation();

CREATE OR REPLACE FUNCTION public.guard_ai_assessment_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  reviewer_role public.user_role;
  reviewer_status public.account_status;
  reviewer_disabled_at timestamptz;
  actor_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.review_status <> 'PENDING'::public.ai_review_status
       OR NEW.reviewed_by_id IS NOT NULL
       OR NEW.reviewed_at IS NOT NULL
       OR NEW.corrected_category_id IS NOT NULL
       OR NEW.corrected_severity IS NOT NULL
       OR NEW.corrected_urgency IS NOT NULL THEN
      RAISE EXCEPTION 'AI assessments must be stored as unreviewed recommendations.'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.complaint_id IS DISTINCT FROM OLD.complaint_id
     OR NEW.model_provider IS DISTINCT FROM OLD.model_provider
     OR NEW.model_name IS DISTINCT FROM OLD.model_name
     OR NEW.model_version IS DISTINCT FROM OLD.model_version
     OR NEW.prompt_version IS DISTINCT FROM OLD.prompt_version
     OR NEW.recommended_category_id IS DISTINCT FROM OLD.recommended_category_id
     OR NEW.recommended_severity IS DISTINCT FROM OLD.recommended_severity
     OR NEW.recommended_urgency IS DISTINCT FROM OLD.recommended_urgency
     OR NEW.confidence IS DISTINCT FROM OLD.confidence
     OR NEW.summary IS DISTINCT FROM OLD.summary
     OR NEW.rationale IS DISTINCT FROM OLD.rationale
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'AI recommendations are immutable; record a new assessment instead.'
      USING ERRCODE = '55000';
  END IF;

  IF NEW.review_status IS DISTINCT FROM OLD.review_status
     OR NEW.corrected_category_id IS DISTINCT FROM OLD.corrected_category_id
     OR NEW.corrected_severity IS DISTINCT FROM OLD.corrected_severity
     OR NEW.corrected_urgency IS DISTINCT FROM OLD.corrected_urgency
     OR NEW.reviewed_by_id IS DISTINCT FROM OLD.reviewed_by_id
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewer_note IS DISTINCT FROM OLD.reviewer_note THEN
    SELECT role, account_status, disabled_at
    INTO reviewer_role, reviewer_status, reviewer_disabled_at
    FROM public.user_profiles
    WHERE id = NEW.reviewed_by_id;

    IF reviewer_role NOT IN ('ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role)
       OR reviewer_status IS DISTINCT FROM 'ACTIVE'::public.account_status
       OR reviewer_disabled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Only an active administrator may review an AI assessment.'
        USING ERRCODE = '42501';
    END IF;

    actor_id := public.app_user_id();
    IF actor_id IS NOT NULL AND actor_id IS DISTINCT FROM NEW.reviewed_by_id THEN
      RAISE EXCEPTION 'The recorded reviewer must match the authenticated actor.'
        USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.audit_logs
      (actor_id, complaint_id, entity_type, entity_id, action, metadata)
    VALUES (
      actor_id,
      NEW.complaint_id,
      'ai_assessment',
      NEW.id,
      'AI_ASSESSMENT_REVIEWED',
      jsonb_build_object(
        'review_status', NEW.review_status,
        'corrected_category_id', NEW.corrected_category_id,
        'corrected_severity', NEW.corrected_severity,
        'corrected_urgency', NEW.corrected_urgency
      )
    );
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER ai_assessments_review_guard
BEFORE INSERT OR UPDATE ON public.ai_assessments
FOR EACH ROW EXECUTE FUNCTION public.guard_ai_assessment_review();

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

    IF author_role NOT IN ('ADMIN'::public.user_role, 'SUPER_ADMIN'::public.user_role)
       OR author_status IS DISTINCT FROM 'ACTIVE'::public.account_status
       OR author_disabled_at IS NOT NULL THEN
      RAISE EXCEPTION 'A student-visible response must be authored by an active administrator.'
        USING ERRCODE = '42501';
    END IF;

    actor_id := public.app_user_id();
    IF actor_id IS NOT NULL AND actor_id IS DISTINCT FROM NEW.author_id THEN
      RAISE EXCEPTION 'The recorded response author must match the authenticated actor.'
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

CREATE TRIGGER student_responses_author_guard
BEFORE INSERT OR UPDATE ON public.student_responses
FOR EACH ROW EXECUTE FUNCTION public.guard_student_response_author();

CREATE OR REPLACE FUNCTION public.audit_student_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.audit_logs
    (actor_id, complaint_id, entity_type, entity_id, action, metadata)
  VALUES (
    NEW.author_id,
    NEW.complaint_id,
    'student_response',
    NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'RESPONSE_CREATED' ELSE 'RESPONSE_EDITED' END,
    jsonb_build_object('edited_at', NEW.edited_at)
  );

  RETURN NEW;
END
$$;

CREATE TRIGGER student_responses_audit
AFTER INSERT OR UPDATE OF body ON public.student_responses
FOR EACH ROW EXECUTE FUNCTION public.audit_student_response();

CREATE OR REPLACE FUNCTION public.audit_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.audit_logs
      (actor_id, entity_type, entity_id, action, metadata)
    VALUES (
      public.app_user_id(),
      'user_profile',
      NEW.id,
      'USER_ROLE_CHANGED',
      jsonb_build_object('from_role', OLD.role, 'to_role', NEW.role)
    );
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER user_profiles_audit_role_change
AFTER UPDATE OF role ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_change();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_intake_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Prisma's privileged database role bypasses RLS; server authorization remains mandatory.
-- Set request.jwt.claim.sub transaction-locally to attribute trigger-generated records.
CREATE POLICY user_profiles_select_self_or_admin ON public.user_profiles
FOR SELECT USING (id = public.app_user_id() OR public.app_is_admin());
CREATE POLICY user_profiles_insert_student_self ON public.user_profiles
FOR INSERT WITH CHECK (
  id = public.app_user_id()
  AND role = 'STUDENT'::public.user_role
  AND account_status = 'ACTIVE'::public.account_status
  AND disabled_at IS NULL
);
CREATE POLICY user_profiles_admin_update ON public.user_profiles
FOR UPDATE USING (public.app_is_admin())
WITH CHECK (public.app_is_admin());

CREATE POLICY departments_authenticated_read ON public.departments
FOR SELECT USING (
  (is_active AND public.app_user_role() IS NOT NULL)
  OR public.app_is_admin()
);
CREATE POLICY departments_admin_insert ON public.departments
FOR INSERT WITH CHECK (public.app_is_admin());
CREATE POLICY departments_admin_update ON public.departments
FOR UPDATE USING (public.app_is_admin())
WITH CHECK (public.app_is_admin());

CREATE POLICY complaint_categories_authenticated_read ON public.complaint_categories
FOR SELECT USING (
  (is_active AND public.app_user_role() IS NOT NULL)
  OR public.app_is_admin()
);
CREATE POLICY complaint_categories_admin_insert ON public.complaint_categories
FOR INSERT WITH CHECK (public.app_is_admin());
CREATE POLICY complaint_categories_admin_update ON public.complaint_categories
FOR UPDATE USING (public.app_is_admin())
WITH CHECK (public.app_is_admin());

CREATE POLICY complaints_scoped_read ON public.complaints
FOR SELECT USING (
  (student_id = public.app_user_id() AND public.app_user_role() = 'STUDENT'::public.user_role)
  OR public.app_is_admin()
);
CREATE POLICY complaints_student_insert ON public.complaints
FOR INSERT WITH CHECK (
  student_id = public.app_user_id()
  AND public.app_user_role() = 'STUDENT'::public.user_role
  AND status = 'SUBMITTED'::public.complaint_status
  AND category_id IS NULL
  AND severity IS NULL
  AND urgency IS NULL
  AND triaged_by_id IS NULL
  AND triaged_at IS NULL
  AND resolved_at IS NULL
  AND closed_at IS NULL
  AND archived_at IS NULL
);
CREATE POLICY complaints_admin_update ON public.complaints
FOR UPDATE USING (public.app_is_admin())
WITH CHECK (public.app_is_admin());

CREATE POLICY complaint_status_history_scoped_read ON public.complaint_status_history
FOR SELECT USING (
  public.app_is_admin()
  OR (
    visible_to_student
    AND public.app_user_role() = 'STUDENT'::public.user_role
    AND EXISTS (
      SELECT 1
      FROM public.complaints AS complaint
      WHERE complaint.id = complaint_id
        AND complaint.student_id = public.app_user_id()
    )
  )
);

CREATE POLICY ai_intake_sessions_owner_read ON public.ai_intake_sessions
FOR SELECT USING (
  (student_id = public.app_user_id() AND public.app_user_role() = 'STUDENT'::public.user_role)
  OR public.app_is_admin()
);
CREATE POLICY ai_intake_sessions_student_insert ON public.ai_intake_sessions
FOR INSERT WITH CHECK (
  student_id = public.app_user_id()
  AND public.app_user_role() = 'STUDENT'::public.user_role
  AND status = 'ACTIVE'::public.intake_session_status
);
CREATE POLICY ai_intake_sessions_owner_update ON public.ai_intake_sessions
FOR UPDATE
USING (
  (
    student_id = public.app_user_id()
    AND public.app_user_role() = 'STUDENT'::public.user_role
    AND status = 'ACTIVE'::public.intake_session_status
  )
  OR public.app_is_admin()
)
WITH CHECK (
  (
    student_id = public.app_user_id()
    AND public.app_user_role() = 'STUDENT'::public.user_role
    AND status IN (
      'ACTIVE'::public.intake_session_status,
      'SUBMITTED'::public.intake_session_status,
      'ABANDONED'::public.intake_session_status,
      'EXPIRED'::public.intake_session_status
    )
  )
  OR public.app_is_admin()
);

CREATE POLICY conversation_messages_scoped_read ON public.conversation_messages
FOR SELECT USING (
  public.app_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.ai_intake_sessions AS session
    WHERE session.id = session_id
      AND session.student_id = public.app_user_id()
      AND public.app_user_role() = 'STUDENT'::public.user_role
  )
);
CREATE POLICY conversation_messages_student_insert ON public.conversation_messages
FOR INSERT WITH CHECK (
  speaker = 'STUDENT'::public.conversation_speaker
  AND EXISTS (
    SELECT 1
    FROM public.ai_intake_sessions AS session
    WHERE session.id = session_id
      AND session.student_id = public.app_user_id()
      AND session.status = 'ACTIVE'::public.intake_session_status
      AND public.app_user_role() = 'STUDENT'::public.user_role
  )
);
CREATE POLICY conversation_messages_server_insert ON public.conversation_messages
FOR INSERT WITH CHECK (
  current_user = 'campusconnect_runtime'
  AND speaker IN (
    'ASSISTANT'::public.conversation_speaker,
    'SYSTEM'::public.conversation_speaker
  )
  AND EXISTS (
    SELECT 1
    FROM public.ai_intake_sessions AS session
    WHERE session.id = session_id
      AND session.student_id = public.app_user_id()
      AND session.status = 'ACTIVE'::public.intake_session_status
      AND public.app_user_role() = 'STUDENT'::public.user_role
  )
);

CREATE POLICY ai_assessments_admin_read ON public.ai_assessments
FOR SELECT USING (public.app_is_admin());
CREATE POLICY ai_assessments_admin_insert ON public.ai_assessments
FOR INSERT WITH CHECK (
  public.app_is_admin()
  AND review_status = 'PENDING'::public.ai_review_status
);
CREATE POLICY ai_assessments_server_insert ON public.ai_assessments
FOR INSERT WITH CHECK (
  current_user = 'campusconnect_runtime'
  AND review_status = 'PENDING'::public.ai_review_status
  AND EXISTS (
    SELECT 1
    FROM public.complaints AS complaint
    WHERE complaint.id = complaint_id
      AND (
        (
          complaint.student_id = public.app_user_id()
          AND public.app_user_role() = 'STUDENT'::public.user_role
        )
        OR public.app_is_admin()
      )
  )
);
CREATE POLICY ai_assessments_admin_update ON public.ai_assessments
FOR UPDATE USING (public.app_is_admin())
WITH CHECK (public.app_is_admin());

CREATE POLICY student_responses_scoped_read ON public.student_responses
FOR SELECT USING (
  public.app_is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.complaints AS complaint
    WHERE complaint.id = complaint_id
      AND complaint.student_id = public.app_user_id()
      AND public.app_user_role() = 'STUDENT'::public.user_role
  )
);
CREATE POLICY student_responses_admin_insert ON public.student_responses
FOR INSERT WITH CHECK (
  public.app_is_admin()
  AND author_id = public.app_user_id()
);
CREATE POLICY student_responses_admin_update ON public.student_responses
FOR UPDATE USING (public.app_is_admin())
WITH CHECK (public.app_is_admin() AND author_id = public.app_user_id());

CREATE POLICY audit_logs_admin_read ON public.audit_logs
FOR SELECT USING (public.app_is_admin());

-- Supabase grants broad defaults to API roles. Grant only the DML required by
-- the RLS policies; never grant DELETE or TRUNCATE on these application tables.
-- Keep these revocations scoped to application objects; do not alter global defaults.
REVOKE ALL PRIVILEGES ON TABLE
  public.user_profiles,
  public.departments,
  public.complaint_categories,
  public.complaints,
  public.complaint_status_history,
  public.ai_intake_sessions,
  public.conversation_messages,
  public.ai_assessments,
  public.student_responses,
  public.audit_logs
FROM PUBLIC, anon, authenticated, service_role;

REVOKE TRUNCATE ON TABLE
  public.user_profiles,
  public.departments,
  public.complaint_categories,
  public.complaints,
  public.complaint_status_history,
  public.ai_intake_sessions,
  public.conversation_messages,
  public.ai_assessments,
  public.student_responses,
  public.audit_logs
FROM PUBLIC, anon, authenticated, service_role;

-- Profile roles are operator-provisioned, never changed through application APIs.
REVOKE UPDATE (role) ON TABLE public.user_profiles
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT ON TABLE public.user_profiles TO authenticated;
GRANT UPDATE (display_name, account_status, disabled_at, updated_at)
  ON TABLE public.user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.departments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.complaint_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.complaints TO authenticated;
GRANT SELECT ON TABLE public.complaint_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_intake_sessions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.conversation_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.student_responses TO authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

REVOKE EXECUTE ON FUNCTION public.app_user_id()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.app_user_role()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.app_is_admin()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_is_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.prevent_user_profile_id_change()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.guard_intake_session_owner()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.guard_complaint_owner()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.guard_complaint_intake_owner()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.prevent_complaint_identity_change()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.log_complaint_status()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.audit_complaint_classification_change()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.prevent_append_only_mutation()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.guard_ai_assessment_review()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.guard_student_response_author()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.audit_student_response()
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.audit_user_role_change()
  FROM PUBLIC, anon, authenticated, service_role;

