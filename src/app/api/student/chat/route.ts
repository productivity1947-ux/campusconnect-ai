import { NextResponse } from "next/server";
import { getRequestProfile } from "@/server/auth";
import { prisma } from "@/server/db/client";
import {
  isSeverityLevel,
  isUrgencyLevel,
} from "@/lib/domain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const modelName = "gemini-3.5-flash-lite";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Draft = {
  title: string;
  description: string;
  summary: string;
  category: string;
  department: string;
  severity: string | null;
  urgency: string | null;
};

function boundedText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function textFromInteraction(body: Record<string, unknown>) {
  if (typeof body.output_text === "string") return body.output_text;
  if (!Array.isArray(body.steps)) return "";

  return body.steps
    .filter(
      (step): step is { type: string; content?: unknown } =>
        Boolean(step) &&
        typeof step === "object" &&
        "type" in step &&
        (step as { type?: unknown }).type === "model_output",
    )
    .flatMap((step) => (Array.isArray(step.content) ? step.content : []))
    .filter(
      (part): part is { type: string; text: string } =>
        Boolean(part) &&
        typeof part === "object" &&
        "type" in part &&
        "text" in part &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("\n");
}

function parseAssistantDraft(text: string): {
  message: string;
  readyToSubmit: boolean;
  draft: Draft;
} | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;

  try {
    const parsed: unknown = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    if (!parsed || typeof parsed !== "object") return null;
    const result = parsed as Record<string, unknown>;
    const draftValue =
      result.draft && typeof result.draft === "object"
        ? (result.draft as Record<string, unknown>)
        : {};
    const message = boundedText(result.message, 1200);
    if (!message) return null;

    return {
      message,
      readyToSubmit: result.readyToSubmit === true,
      draft: {
        title: boundedText(draftValue.title, 200),
        description: boundedText(draftValue.description, 10000),
        summary: boundedText(draftValue.summary, 3000),
        category: boundedText(draftValue.category, 120),
        department: boundedText(draftValue.department, 120),
        severity: isSeverityLevel(draftValue.severity)
          ? draftValue.severity
          : null,
        urgency: isUrgencyLevel(draftValue.urgency)
          ? draftValue.urgency
          : null,
      },
    };
  } catch {
    return null;
  }
}

function fallbackResponse(message: string, status = 200) {
  return NextResponse.json(
    { fallbackMode: true, error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackResponse(
      "AI is not configured. Continue with the clearly labelled manual grievance form.",
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const message = boundedText(body.message, 3000);
  const sessionId =
    typeof body.sessionId === "string" && uuidPattern.test(body.sessionId)
      ? body.sessionId
      : null;
  if (!message) {
    return NextResponse.json(
      { error: "Write a short description before sending." },
      { status: 400 },
    );
  }
  if (body.sessionId && !sessionId) {
    return NextResponse.json({ error: "Invalid chat session." }, { status: 400 });
  }

  try {
    const session = sessionId
      ? await prisma.aiIntakeSession.findFirst({
          where: {
            id: sessionId,
            studentId: auth.profile.id,
            status: "ACTIVE",
          },
          select: { id: true },
        })
      : null;
    if (sessionId && !session) {
      return NextResponse.json(
        { error: "That chat session is no longer available." },
        { status: 404 },
      );
    }

    const previousMessages = session
      ? await prisma.conversationMessage.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: "asc" },
          take: 16,
          select: { speaker: true, content: true },
        })
      : [];
    const input = [
      ...previousMessages.map((item) => ({
        type: item.speaker === "STUDENT" ? "user_input" : "model_output",
        content: [{ type: "text", text: item.content }],
      })),
      { type: "user_input", content: [{ type: "text", text: message }] },
    ];

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: modelName,
          input,
          store: false,
          generation_config: { max_output_tokens: 900 },
          system_instruction: [
            "You are CampusConnect AI, a respectful college grievance intake assistant.",
            "Ask one concise follow-up question at a time until you understand what happened, where and when, its impact, and the student's preferred outcome.",
            "Never decide whether a grievance is valid, never reject or close it, and treat severity and urgency as suggestions for staff review.",
            "Do not ask for passwords, government identifiers, or unnecessary sensitive information.",
            "Suggest a broad category and a likely campus department, not a guaranteed assignment.",
            "Respond only as JSON with keys message (string), readyToSubmit (boolean), and draft (object with title, description, summary, category, department, severity, urgency).",
            "Set readyToSubmit true only when the student has enough information to review a clear title and description. Use severity LOW, MEDIUM, HIGH, or CRITICAL and urgency ROUTINE, SOON, URGENT, or IMMEDIATE, or null.",
            "Use concise, plain language. The student must review and confirm the draft before it is saved.",
          ].join(" "),
        }),
        signal: AbortSignal.timeout(45000),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("Gemini request failed with status", response.status);
      return fallbackResponse(
        "The AI assistant is temporarily unavailable. You can continue with the manual grievance form.",
        503,
      );
    }

    const responseBody = (await response.json()) as Record<string, unknown>;
    const parsed = parseAssistantDraft(textFromInteraction(responseBody));
    if (!parsed) {
      return fallbackResponse(
        "The AI could not prepare a reliable reply. Continue with the manual grievance form.",
        503,
      );
    }

    const savedSessionId = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT set_config('request.jwt.claim.sub', ${auth.profile.id}, true)`;
      const activeSession = session
        ? session
        : await transaction.aiIntakeSession.create({
            data: {
              studentId: auth.profile.id,
              status: "ACTIVE",
              modelName,
            },
            select: { id: true },
          });
      await transaction.conversationMessage.createMany({
        data: [
          {
            sessionId: activeSession.id,
            speaker: "STUDENT",
            content: message,
          },
          {
            sessionId: activeSession.id,
            speaker: "ASSISTANT",
            content: parsed.message,
            metadata: {
              readyToSubmit: parsed.readyToSubmit,
              draft: parsed.draft,
              modelName,
            },
          },
        ],
      });
      await transaction.aiIntakeSession.update({
        where: { id: activeSession.id },
        data: { lastActivityAt: new Date() },
      });
      return activeSession.id;
    });

    return NextResponse.json(
      {
        sessionId: savedSessionId,
        fallbackMode: false,
        ...parsed,
        modelName,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Grievance chat failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "The chat could not be saved. Please try again or use the manual form." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
