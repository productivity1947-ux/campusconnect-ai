import { NextResponse } from "next/server";
import { grievanceReference } from "@/lib/domain";
import { getRequestProfile } from "@/server/auth";
import { prisma } from "@/server/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function responseForAuthFailure(auth: {
  status: number;
  message: string;
}) {
  return NextResponse.json(
    { error: auth.message },
    { status: auth.status, headers: { "Cache-Control": "no-store" } },
  );
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function bounded(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export async function GET(request: Request) {
  const auth = await getRequestProfile(request);
  if (!auth.ok) return responseForAuthFailure(auth);
  if (auth.profile.role !== "STUDENT") {
    return NextResponse.json({ error: "Student access is required." }, { status: 403 });
  }

  try {
    const complaints = await prisma.complaint.findMany({
      where: { studentId: auth.profile.id },
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { name: true, department: { select: { name: true } } } },
        aiAssessments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            summary: true,
            rationale: true,
            recommendedSeverity: true,
            recommendedUrgency: true,
          },
        },
        statusHistory: {
          where: { visibleToStudent: true },
          orderBy: { createdAt: "asc" },
          select: { fromStatus: true, toStatus: true, createdAt: true },
        },
        responses: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            body: true,
            createdAt: true,
            author: { select: { role: true } },
          },
        },
      },
    });

    const records = complaints.map((complaint) => ({
      ...complaint,
      reference: grievanceReference(complaint.id, complaint.createdAt),
      assessment: complaint.aiAssessments[0] ?? null,
      aiAssessments: undefined,
      responses: complaint.responses.map((response) => ({
        id: response.id,
        body: response.body,
        createdAt: response.createdAt,
        senderRole: response.author.role === "STUDENT" ? "STUDENT" : "ADMIN",
      })),
    }));
    const activeCount = records.filter(
      (item) => !["RESOLVED", "REJECTED", "CLOSED"].includes(item.status),
    ).length;

    return NextResponse.json(
      { complaints: records, counts: { total: records.length, active: activeCount } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Student grievance list failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Your grievances could not be loaded. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  const auth = await getRequestProfile(request);
  if (!auth.ok) return responseForAuthFailure(auth);
  if (auth.profile.role !== "STUDENT") {
    return NextResponse.json({ error: "Student access is required." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isJsonObject(payload)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const title = bounded(payload.title, 200);
  const description = bounded(payload.description, 10000);
  if (payload.isAnonymous !== undefined && typeof payload.isAnonymous !== "boolean") {
    return NextResponse.json(
      { error: "Anonymous submission must be selected or cleared." },
      { status: 400 },
    );
  }
  const isAnonymous = payload.isAnonymous === true;
  const sessionId =
    typeof payload.sessionId === "string" && uuidPattern.test(payload.sessionId)
      ? payload.sessionId
      : null;
  const manualMode = payload.manual === true;
  if (!title || title.length < 5 || !description || description.length < 20) {
    return NextResponse.json(
      { error: "Add a clear title and at least 20 characters describing the concern." },
      { status: 400 },
    );
  }
  if (payload.sessionId && !sessionId) {
    return NextResponse.json({ error: "Invalid chat session." }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT set_config('request.jwt.claim.sub', ${auth.profile.id}, true)`;

      let aiDraft:
        | {
            summary: string;
            rationale: string;
            severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
            urgency: "ROUTINE" | "SOON" | "URGENT" | "IMMEDIATE" | null;
            modelName: string;
          }
        | null = null;

      if (sessionId) {
        const session = await transaction.aiIntakeSession.findFirst({
          where: {
            id: sessionId,
            studentId: auth.profile.id,
            status: "ACTIVE",
          },
          select: { id: true },
        });
        if (!session) throw new Error("INTAKE_SESSION_NOT_AVAILABLE");

        if (!manualMode) {
          const latestAssistant = await transaction.conversationMessage.findFirst({
            where: { sessionId: session.id, speaker: "ASSISTANT" },
            orderBy: { createdAt: "desc" },
            select: { metadata: true },
          });
          const metadata = latestAssistant?.metadata;
          if (!isJsonObject(metadata) || metadata.readyToSubmit !== true) {
            throw new Error("INTAKE_REVIEW_REQUIRED");
          }

          const draft = isJsonObject(metadata.draft) ? metadata.draft : {};
          const category = bounded(draft.category, 120);
          const department = bounded(draft.department, 120);
          const summary = bounded(draft.summary, 3000);
          const severity = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(
            String(draft.severity),
          )
            ? (String(draft.severity) as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")
            : null;
          const urgency = ["ROUTINE", "SOON", "URGENT", "IMMEDIATE"].includes(
            String(draft.urgency),
          )
            ? (String(draft.urgency) as
                | "ROUTINE"
                | "SOON"
                | "URGENT"
                | "IMMEDIATE")
            : null;
          aiDraft = {
            summary: summary || description,
            rationale: [
              category ? `Suggested category: ${category}` : "",
              department ? `Suggested department: ${department}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            severity,
            urgency,
            modelName: bounded(metadata.modelName, 160) || "gemini-3.5-flash-lite",
          };
        }
      }

      const complaint = await transaction.complaint.create({
        data: {
          studentId: auth.profile.id,
          intakeSessionId: sessionId,
          title,
          description,
          status: "SUBMITTED",
          isAnonymous,
        },
        select: { id: true, createdAt: true, status: true },
      });

      if (aiDraft) {
        await transaction.aiAssessment.create({
          data: {
            complaintId: complaint.id,
            modelProvider: "Google",
            modelName: aiDraft.modelName,
            summary: aiDraft.summary,
            rationale: aiDraft.rationale || null,
            recommendedSeverity: aiDraft.severity,
            recommendedUrgency: aiDraft.urgency,
            reviewStatus: "PENDING",
          },
        });
      }
      if (sessionId) {
        await transaction.aiIntakeSession.update({
          where: { id: sessionId },
          data: { status: "SUBMITTED", endedAt: new Date() },
        });
      }

      return {
        id: complaint.id,
        reference: grievanceReference(complaint.id, complaint.createdAt),
        createdAt: complaint.createdAt,
        status: complaint.status,
      };
    });

    return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "INTAKE_SESSION_NOT_AVAILABLE") {
      return NextResponse.json(
        { error: "This chat has already been submitted or is no longer available." },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === "INTAKE_REVIEW_REQUIRED") {
      return NextResponse.json(
        { error: "Please complete the AI intake and review its draft before submitting." },
        { status: 400 },
      );
    }
    console.error(
      "Grievance submission failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Your grievance could not be submitted. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
