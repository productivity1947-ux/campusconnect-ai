"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { PortalGuard } from "@/features/auth/portal-guard";
import { useAuth } from "@/features/auth/auth-provider";
import { complaintStatusLabels, type PortalComplaintStatus } from "@/lib/domain";

type ComplaintDetail = {
  id: string;
  reference: string;
  title: string;
  description: string;
  status: PortalComplaintStatus;
  isAnonymous: boolean;
  severity: string | null;
  urgency: string | null;
  createdAt: string;
  updatedAt: string;
  category: { name: string; department: { name: string } | null } | null;
  intakeMessages: {
    id: string;
    speaker: "STUDENT" | "ASSISTANT" | "SYSTEM";
    content: string;
    createdAt: string;
  }[];
  assessment: {
    summary: string | null;
    rationale: string | null;
    recommendedSeverity: string | null;
    recommendedUrgency: string | null;
  } | null;
  statusHistory: {
    fromStatus: string | null;
    toStatus: string;
    createdAt: string;
  }[];
  responses: {
    id: string;
    body: string;
    createdAt: string;
    senderRole: "STUDENT" | "ADMIN";
  }[];
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusStyle(status: string) {
  if (status === "RESOLVED") return "bg-emerald-50 text-emerald-700";
  if (status === "REJECTED") return "bg-rose-50 text-rose-700";
  if (status === "CLOSED") return "bg-slate-100 text-slate-700";
  if (status === "IN_PROGRESS" || status === "TRIAGED" || status === "REOPENED") {
    return "bg-blue-50 text-blue-700";
  }
  return "bg-amber-50 text-amber-800";
}

export function StudentComplaintDetail({ id }: { id: string }) {
  return (
    <PortalGuard role="student">
      <StudentComplaintDetailContent id={id} />
    </PortalGuard>
  );
}

function StudentComplaintDetailContent({ id }: { id: string }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const loadComplaint = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch(`/api/student/complaints/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        complaint?: ComplaintDetail;
        error?: string;
      };
      if (!response.ok || !body.complaint) {
        throw new Error(body.error ?? "The grievance could not be loaded.");
      }
      setComplaint(body.complaint);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "The grievance could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadComplaint(), 0);
    return () => window.clearTimeout(timer);
  }, [loadComplaint]);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !complaint || !reply.trim()) return;
    setSaving(true);
    setReplyError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/student/complaints/${complaint.id}/responses`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ body: reply.trim() }),
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Your reply could not be sent.");
      }
      setReply("");
      setNotice("Your reply was sent to the campus team.");
      await loadComplaint();
    } catch (error) {
      setReplyError(
        error instanceof Error ? error.message : "Your reply could not be sent.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <PortalShell
      role="student"
      title={complaint?.title ?? "Grievance details"}
      description={
        complaint
          ? `Reference ${complaint.reference} · Submitted ${dateLabel(complaint.createdAt)}`
          : "View your grievance, updates, and campus team replies."
      }
    >
      <Link
        className="mb-5 inline-flex text-sm font-semibold text-brand hover:underline"
        href="/student"
      >
        Back to my grievances
      </Link>

      {loading ? (
        <p className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-muted">
          Loading grievance…
        </p>
      ) : loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-800" role="alert">{loadError}</p>
          <button className="button-secondary mt-3" onClick={() => void loadComplaint()}>
            Try again
          </button>
        </div>
      ) : complaint ? (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <section className="rounded-2xl border border-line bg-white p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-brand">
                  {complaint.reference}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(complaint.status)}`}>
                  {complaintStatusLabels[complaint.status]}
                </span>
                {complaint.isAnonymous ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    Submitted anonymously
                  </span>
                ) : null}
              </div>
              <h2 className="mt-4 text-xl font-semibold text-ink">What you reported</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink">
                {complaint.description}
              </p>
              {complaint.assessment ? (
                <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
                  <h3 className="text-sm font-semibold text-blue-950">
                    AI suggestions · staff review required
                  </h3>
                  {complaint.assessment.summary ? (
                    <p className="mt-2 text-sm leading-6 text-blue-950">
                      {complaint.assessment.summary}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs leading-5 text-blue-900">
                    Priority: {complaint.assessment.recommendedSeverity ?? "Not specified"}
                    {complaint.assessment.recommendedUrgency
                      ? ` · Urgency: ${complaint.assessment.recommendedUrgency}`
                      : ""}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 sm:p-7">
              <h2 className="text-lg font-semibold text-ink">Conversation</h2>
              {complaint.responses.length ? (
                <ol className="mt-4 space-y-3">
                  {complaint.responses.map((message) => (
                    <li
                      className={`max-w-[92%] rounded-2xl border p-4 ${
                        message.senderRole === "STUDENT"
                          ? "ml-auto border-blue-100 bg-blue-50"
                          : "border-line bg-canvas"
                      }`}
                      key={message.id}
                    >
                      <p className="text-xs font-semibold text-brand">
                        {message.senderRole === "STUDENT" ? "You" : "Campus team"}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
                        {message.body}
                      </p>
                      <p className="mt-2 text-xs text-muted">{dateLabel(message.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  No messages yet. Campus team replies will appear here.
                </p>
              )}
              {complaint.status === "CLOSED" || complaint.status === "REJECTED" ? (
                <p className="mt-5 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                  This grievance is closed and no longer accepts replies.
                </p>
              ) : (
                <form className="mt-5 space-y-3 border-t border-line pt-5" onSubmit={sendReply}>
                  <label className="block text-sm font-medium text-ink">
                    Reply to the campus team
                    <textarea
                      className="form-input mt-2 min-h-24 resize-y"
                      maxLength={5000}
                      onChange={(event) => setReply(event.target.value)}
                      required
                      value={reply}
                    />
                  </label>
                  {replyError ? (
                    <p className="text-sm text-red-700" role="alert">{replyError}</p>
                  ) : null}
                  {notice ? (
                    <p className="text-sm text-emerald-800" role="status">{notice}</p>
                  ) : null}
                  <button className="button-primary" disabled={saving || !reply.trim()}>
                    {saving ? "Sending…" : "Send reply"}
                  </button>
                </form>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            {complaint.intakeMessages.length ? (
              <section className="rounded-2xl border border-line bg-white p-5">
                <h2 className="font-semibold text-ink">AI intake history</h2>
                <ol className="mt-4 space-y-3">
                  {complaint.intakeMessages.map((message) => (
                    <li
                      className="rounded-xl bg-canvas p-3"
                      key={message.id}
                    >
                      <p className="text-xs font-semibold text-brand">
                        {message.speaker === "STUDENT"
                          ? "You"
                          : message.speaker === "ASSISTANT"
                            ? "CampusConnect assistant"
                            : "System"}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">
                        {message.content}
                      </p>
                      <p className="mt-2 text-xs text-muted">{dateLabel(message.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-semibold text-ink">Status history</h2>
              {complaint.statusHistory.length ? (
                <ol className="mt-4 space-y-4">
                  {complaint.statusHistory.map((entry, index) => (
                    <li
                      className="flex gap-3 text-sm"
                      key={`${entry.toStatus}-${entry.createdAt}-${index}`}
                    >
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
                      <span>
                        <span className="font-medium text-ink">
                          {complaintStatusLabels[entry.toStatus as PortalComplaintStatus] ??
                            entry.toStatus}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          {dateLabel(entry.createdAt)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-muted">No status updates yet.</p>
              )}
            </section>

            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="font-semibold text-ink">Classification</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted">Category</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {complaint.category?.name ?? "Not assigned"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Department</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {complaint.category?.department?.name ?? "Not assigned"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Priority</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {complaint.severity ??
                      complaint.assessment?.recommendedSeverity ??
                      "Not specified"}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      ) : null}
    </PortalShell>
  );
}
