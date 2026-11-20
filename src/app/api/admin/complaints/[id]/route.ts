import { NextResponse } from "next/server";
import {
  isComplaintStatus,
  isSeverityLevel,
  grievanceReference,
  severityLevels,
  type PortalComplaintStatus,
} from "@/lib/domain";
import { getRequestProfile, isAdministrator } from "@/server/auth";
import { prisma } from "@/server/db/client";
import { serializeAdminComplaint } from "@/server/admin-complaint-privacy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function findComplaint(id: string) {
  return prisma.complaint.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      severity: true,
      urgency: true,
      isAnonymous: true,
      createdAt: true,
      updatedAt: true,
      student: { select: { id: true, email: true, displayName: true } },
      category: {
        select: { name: true, department: { select: { name: true } } },
      },
      aiAssessments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          summary: true,
          rationale: true,
          recommendedSeverity: true,
          recommendedUrgency: true,
          reviewStatus: true,
        },
      },
      statusHistory: {
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
}

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
  if (!isAdministrator(auth.profile)) {
    return NextResponse.json(
      { error: "Administrator access is required." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid grievance reference." }, { status: 400 });
  }

  try {
    const complaint = await findComplaint(id);
    if (!complaint) {
      return NextResponse.json({ error: "Grievance not found." }, { status: 404 });
    }
    return NextResponse.json(
      {
        complaint: serializeAdminComplaint(
          complaint,
          grievanceReference(complaint.id, complaint.createdAt),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Administrator grievance detail failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "The grievance details could not be loaded. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function PATCH(
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
  if (!isAdministrator(auth.profile)) {
    return NextResponse.json(
      { error: "Administrator access is required." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { id } = await context.params;
  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid grievance reference." }, { status: 400 });
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

  let requestedStatus: PortalComplaintStatus | undefined;
  if (payload.status !== undefined) {
    if (!isComplaintStatus(payload.status)) {
      return NextResponse.json(
        { error: "Select a valid grievance status." },
        { status: 400 },
      );
    }
    requestedStatus = payload.status;
  }
  let requestedSeverity: (typeof severityLevels)[number] | undefined;
  if (payload.severity !== undefined) {
    if (!isSeverityLevel(payload.severity)) {
      return NextResponse.json(
        { error: "Select a valid priority." },
        { status: 400 },
      );
    }
    requestedSeverity = payload.severity;
  }
  if (payload.response !== undefined && typeof payload.response !== "string") {
    return NextResponse.json(
      { error: "Responses must be plain text." },
      { status: 400 },
    );
  }
  const responseBody =
    typeof payload.response === "string" ? payload.response.trim() : "";
  if (requestedStatus === undefined && requestedSeverity === undefined && !responseBody) {
    return NextResponse.json(
      { error: "Choose a status or write a response before saving." },
      { status: 400 },
    );
  }
  if (responseBody.length > 5000) {
    return NextResponse.json(
      { error: "Responses must be 5,000 characters or fewer." },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT set_config('request.jwt.claim.sub', ${auth.profile.id}, true)`;
      const current = await transaction.complaint.findUnique({
        where: { id },
        select: { id: true, status: true, severity: true },
      });
      if (!current) return null;

      const statusChanged =
        requestedStatus !== undefined && requestedStatus !== current.status;
      const severityChanged =
        requestedSeverity !== undefined && requestedSeverity !== current.severity;
      if (!statusChanged && !severityChanged && !responseBody) {
        throw new Error("GRIEVANCE_STATUS_UNCHANGED");
      }

      if (statusChanged || severityChanged) {
        const now = new Date();
        const updateData = {
          ...(statusChanged && requestedStatus
            ? {
                status: requestedStatus,
                resolvedAt: requestedStatus === "RESOLVED" ? now : null,
                closedAt:
                  requestedStatus === "CLOSED" || requestedStatus === "REJECTED"
                    ? now
                    : null,
                ...(requestedStatus === "TRIAGED"
                  ? { triagedById: auth.profile.id, triagedAt: now }
                  : {}),
              }
            : {}),
          ...(severityChanged && requestedSeverity
            ? { severity: requestedSeverity }
            : {}),
        };
        const result = await transaction.complaint.updateMany({
          where: { id, status: current.status, severity: current.severity },
          data: updateData,
        });
        if (result.count !== 1) {
          throw new Error("GRIEVANCE_STATUS_CHANGED");
        }
      }

      if (responseBody) {
        await transaction.studentResponse.create({
          data: {
            complaintId: id,
            authorId: auth.profile.id,
            body: responseBody,
          },
        });
      }

      return transaction.complaint.findUnique({
        where: { id },
        select: { id: true, status: true, severity: true, updatedAt: true },
      });
    });

    if (!updated) {
      return NextResponse.json({ error: "Grievance not found." }, { status: 404 });
    }
    return NextResponse.json(
      { complaint: updated },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "GRIEVANCE_STATUS_UNCHANGED") {
      return NextResponse.json(
        { error: "Choose a different status or priority, or write a response before saving." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "GRIEVANCE_STATUS_CHANGED") {
      return NextResponse.json(
        { error: "Another administrator updated this grievance. Refresh and try again." },
        { status: 409 },
      );
    }
    console.error(
      "Administrator grievance update failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "The grievance could not be updated. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
