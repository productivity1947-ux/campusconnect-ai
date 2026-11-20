import { NextResponse } from "next/server";
import { getRequestProfile } from "@/server/auth";
import { prisma } from "@/server/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isJsonObject(payload) || typeof payload.body !== "string") {
    return NextResponse.json(
      { error: "Enter a response before sending." },
      { status: 400 },
    );
  }
  const body = payload.body.trim();
  if (!body || body.length > 5000) {
    return NextResponse.json(
      { error: "Responses must be between 1 and 5,000 characters." },
      { status: 400 },
    );
  }

  try {
    const created = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT set_config('request.jwt.claim.sub', ${auth.profile.id}, true)`;
      const complaint = await transaction.complaint.findFirst({
        where: { id, studentId: auth.profile.id },
        select: { id: true, status: true },
      });
      if (!complaint) return null;
      if (complaint.status === "CLOSED" || complaint.status === "REJECTED") {
        return "CLOSED";
      }

      const response = await transaction.studentResponse.create({
        data: {
          complaintId: complaint.id,
          authorId: auth.profile.id,
          body,
        },
        select: { id: true, body: true, createdAt: true },
      });
      return response;
    });

    if (!created) {
      return NextResponse.json({ error: "Grievance not found." }, { status: 404 });
    }
    if (created === "CLOSED") {
      return NextResponse.json(
        { error: "This grievance is closed and no longer accepts replies." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { response: { ...created, senderRole: "STUDENT" } },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Student grievance reply failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Your reply could not be sent. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
