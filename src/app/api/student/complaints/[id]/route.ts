import { NextResponse } from "next/server";
import { grievanceReference } from "@/lib/domain";
import { getRequestProfile } from "@/server/auth";
import { prisma } from "@/server/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await getRequestProfile(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (auth.profile.role !== "STUDENT") {
    return NextResponse.json(
      { error: "Student access is required." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid grievance reference." }, { status: 400 });
  }

  try {
    const complaint = await prisma.complaint.findFirst({
      where: { id, studentId: auth.profile.id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        isAnonymous: true,
        severity: true,
        urgency: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: { name: true, department: { select: { name: true } } },
        },
        intakeSession: {
          select: {
            messages: {
              orderBy: { createdAt: "asc" },
              select: { id: true, speaker: true, content: true, createdAt: true },
            },
          },
        },
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
    if (!complaint) {
      return NextResponse.json({ error: "Grievance not found." }, { status: 404 });
    }

    return NextResponse.json(
      {
        complaint: {
          id: complaint.id,
          reference: grievanceReference(complaint.id, complaint.createdAt),
          title: complaint.title,
          description: complaint.description,
          status: complaint.status,
          isAnonymous: complaint.isAnonymous,
          severity: complaint.severity,
          urgency: complaint.urgency,
          createdAt: complaint.createdAt,
          updatedAt: complaint.updatedAt,
          category: complaint.category,
          intakeMessages: complaint.intakeSession?.messages ?? [],
          assessment: complaint.aiAssessments[0] ?? null,
          statusHistory: complaint.statusHistory,
          responses: complaint.responses.map((response) => ({
            id: response.id,
            body: response.body,
            createdAt: response.createdAt,
            senderRole: response.author.role === "STUDENT" ? "STUDENT" : "ADMIN",
          })),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Student grievance detail failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "The grievance could not be loaded. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
