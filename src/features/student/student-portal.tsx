"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { PortalGuard } from "@/features/auth/portal-guard";
import { useAuth } from "@/features/auth/auth-provider";
import { complaintStatusLabels, type PortalComplaintStatus } from "@/lib/domain";

type ComplaintRecord = {
  id: string;
  reference: string;
  title: string;
  description: string;
  status: PortalComplaintStatus;
  isAnonymous: boolean;
  createdAt: string;
  category: { name: string; department: { name: string } | null } | null;
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

type AssistantDraft = {
  title: string;
  description: string;
  summary: string;
  category: string;
  department: string;
  severity: string | null;
  urgency: string | null;
};

type ChatMessage = { speaker: "STUDENT" | "ASSISTANT"; content: string };

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

export function StudentPortal() {
  return (
    <PortalGuard role="student">
      <StudentDashboard />
    </PortalGuard>
  );
}

function StudentDashboard() {
  const { profile, session } = useAuth();
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [chatText, setChatText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [submittedReference, setSubmittedReference] = useState("");
  const token = session?.access_token;

  const refreshComplaints = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/student/complaints", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await response.json()) as {
        complaints?: ComplaintRecord[];
        error?: string;
      };
      if (!response.ok || !body.complaints) {
        throw new Error(body.error ?? "Your grievances could not be loaded.");
      }
      setComplaints(body.complaints);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Your grievances could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshComplaints(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshComplaints]);

  const activeCount = useMemo(
    () =>
      complaints.filter(
        (item) => !["RESOLVED", "REJECTED", "CLOSED"].includes(item.status),
      ).length,
    [complaints],
  );
  const resolvedCount = useMemo(
    () => complaints.filter((item) => item.status === "RESOLVED").length,
    [complaints],
  );

  function startGrievance() {
    setComposerOpen(true);
    setManualMode(false);
    setChatText("");
    setChatMessages([]);
    setChatSessionId(null);
    setDraft(null);
    setReviewOpen(false);
    setTitle("");
    setDescription("");
    setIsAnonymous(false);
    setFormError("");
  }

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !chatText.trim()) return;
    const message = chatText.trim();
    setBusy(true);
    setFormError("");
    setChatMessages((current) => [...current, { speaker: "STUDENT", content: message }]);
    setChatText("");

    try {
      const response = await fetch("/api/student/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, sessionId: chatSessionId }),
      });
      const body = (await response.json()) as {
        sessionId?: string;
        fallbackMode?: boolean;
        error?: string;
        message?: string;
        readyToSubmit?: boolean;
        draft?: AssistantDraft;
      };
      if (body.fallbackMode) {
        setManualMode(true);
        setDescription(
          [...chatMessages.filter((item) => item.speaker === "STUDENT").map((item) => item.content), message]
            .join("\n\n")
            .slice(0, 10000),
        );
        setFormError(body.error ?? "AI is unavailable; use the manual form.");
        setChatMessages((current) => [
          ...current,
          {
            speaker: "ASSISTANT",
            content:
              "The assistant is unavailable right now. Your concern is still important—continue with the manual form below.",
          },
        ]);
        return;
      }
      if (!response.ok || !body.message) {
        throw new Error(body.error ?? "The assistant could not reply.");
      }
      setChatSessionId(body.sessionId ?? null);
      setChatMessages((current) => [
        ...current,
        { speaker: "ASSISTANT", content: body.message! },
      ]);
      if (body.draft) {
        setDraft(body.draft);
        setTitle(body.draft.title);
        setDescription(body.draft.description);
      }
      if (body.readyToSubmit) setReviewOpen(true);
    } catch (error) {
      setManualMode(true);
      setDescription(
        [...chatMessages.filter((item) => item.speaker === "STUDENT").map((item) => item.content), message]
          .join("\n\n")
          .slice(0, 10000),
      );
      setFormError(
        error instanceof Error
          ? error.message
          : "The assistant could not reply. Use the manual form instead.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitGrievance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setFormError("");
    try {
      const response = await fetch("/api/student/complaints", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          sessionId: chatSessionId,
          manual: manualMode,
          isAnonymous,
        }),
      });
      const body = (await response.json()) as {
        reference?: string;
        error?: string;
      };
      if (!response.ok || !body.reference) {
        throw new Error(body.error ?? "The grievance could not be submitted.");
      }
      setSubmittedReference(body.reference);
      setComposerOpen(false);
      setReviewOpen(false);
      await refreshComplaints();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "The grievance could not be submitted. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell
      role="student"
      title={`Welcome${profile?.displayName ? `, ${profile.displayName.split(" ")[0]}` : ""}.`}
      description="Share a concern, then follow its progress and campus responses here."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            Signed in as <span className="font-medium text-ink">{profile?.email}</span>
          </p>
        </div>
        <button className="button-primary" onClick={startGrievance} type="button">
          Start a grievance
        </button>
      </div>

      {submittedReference ? (
        <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">
            Submitted successfully. Your reference is{" "}
            <span className="font-bold">{submittedReference}</span>
          </p>
          <button
            className="text-left text-sm font-semibold underline underline-offset-2"
            onClick={() => setSubmittedReference("")}
            type="button"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <section aria-label="Grievance summary" className="mt-7 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total submitted", value: loading ? "—" : complaints.length },
          { label: "Awaiting resolution", value: loading ? "—" : activeCount },
          { label: "Resolved", value: loading ? "—" : resolvedCount },
        ].map((item) => (
          <article className="rounded-2xl border border-line bg-white p-5" key={item.label}>
            <p className="text-sm font-medium text-muted">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              {item.value}
            </p>
            <p className="mt-1 text-xs text-muted">From your saved grievances</p>
          </article>
        ))}
      </section>

      {composerOpen ? (
        <section className="mt-8 overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:px-7">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
                New grievance
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                {manualMode ? "Manual submission" : "Tell us what happened"}
              </h2>
            </div>
            <button
              className="button-secondary"
              onClick={() => setComposerOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="border-b border-line p-5 sm:p-7 lg:border-r lg:border-b-0">
              {manualMode ? (
                <form className="space-y-4" onSubmit={submitGrievance}>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                    <strong>Manual fallback:</strong> The AI assistant is unavailable. You
                    can still submit your grievance directly.
                  </div>
                  <label className="block text-sm font-medium text-ink">
                    Grievance title
                    <input
                      className="form-input mt-2"
                      maxLength={200}
                      minLength={5}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                      value={title}
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    What happened?
                    <textarea
                      className="form-input mt-2 min-h-36 resize-y"
                      maxLength={10000}
                      minLength={20}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Include where and when it happened, how it affected you, and what outcome would help."
                      required
                      value={description}
                    />
                  </label>
                  {formError ? (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                      {formError}
                    </p>
                  ) : null}
                  <button className="button-primary w-full sm:w-auto" disabled={busy}>
                    {busy ? "Submitting…" : "Submit grievance"}
                  </button>
                </form>
              ) : reviewOpen && draft ? (
                <form className="space-y-4" onSubmit={submitGrievance}>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-900">
                    Review and edit the AI-prepared draft. Nothing is submitted until you
                    confirm.
                  </div>
                  <label className="block text-sm font-medium text-ink">
                    Suggested title
                    <input
                      className="form-input mt-2"
                      maxLength={200}
                      minLength={5}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                      value={title}
                    />
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    Grievance description
                    <textarea
                      className="form-input mt-2 min-h-36 resize-y"
                      maxLength={10000}
                      minLength={20}
                      onChange={(event) => setDescription(event.target.value)}
                      required
                      value={description}
                    />
                  </label>
                  <div className="grid gap-3 rounded-xl bg-canvas p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-muted">Suggested category</p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {draft.category || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted">Suggested department</p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {draft.department || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted">Suggested priority</p>
                      <p className="mt-1 text-sm font-semibold text-ink">
                        {draft.severity ?? "Not specified"}
                      </p>
                    </div>
                    <p className="self-end text-xs leading-5 text-muted">
                      Suggestions only; campus staff make the final decision.
                    </p>
                  </div>
                  {formError ? (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                      {formError}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-3">
                    <button className="button-primary" disabled={busy}>
                      {busy ? "Submitting…" : "Confirm and submit"}
                    </button>
                    <button
                      className="button-secondary"
                      onClick={() => setReviewOpen(false)}
                      type="button"
                    >
                      Continue chat
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-sm leading-6 text-blue-900">
                    The assistant helps organize your concern. You will review the draft
                    before anything is submitted.
                  </div>
                  <div
                    aria-live="polite"
                    className="flex max-h-[360px] min-h-48 flex-col gap-3 overflow-y-auto rounded-2xl bg-canvas p-4"
                  >
                    {chatMessages.length === 0 ? (
                      <p className="my-auto text-sm leading-6 text-muted">
                        Start with a sentence or two about the campus issue. For example:
                        “The lights in the library study room have been out since Monday.”
                      </p>
                    ) : (
                      chatMessages.map((message, index) => (
                        <div
                          className={
                            message.speaker === "STUDENT"
                              ? "ml-auto max-w-[88%] rounded-2xl rounded-br-sm bg-ink px-4 py-3 text-sm leading-6 text-white"
                              : "mr-auto max-w-[88%] rounded-2xl rounded-tl-sm border border-line bg-white px-4 py-3 text-sm leading-6 text-ink"
                          }
                          key={`${index}-${message.speaker}`}
                        >
                          {message.content}
                        </div>
                      ))
                    )}
                    {busy ? (
                      <p className="text-xs font-medium text-muted">Assistant is preparing a reply…</p>
                    ) : null}
                  </div>
                  <form className="mt-4 flex gap-2" onSubmit={sendChat}>
                    <input
                      aria-label="Message the grievance assistant"
                      className="form-input"
                      maxLength={3000}
                      onChange={(event) => setChatText(event.target.value)}
                      placeholder="Describe what happened…"
                      value={chatText}
                    />
                    <button className="button-primary shrink-0" disabled={busy || !chatText.trim()}>
                      Send
                    </button>
                  </form>
                  {formError ? (
                    <p className="mt-3 text-sm text-amber-800" role="status">{formError}</p>
                  ) : null}
                  {draft && !reviewOpen ? (
                    <button
                      className="button-secondary mt-4 w-full"
                      onClick={() => {
                        setManualMode(true);
                        setTitle(draft.title);
                        setDescription(draft.description);
                      }}
                      type="button"
                    >
                      Use the manual form instead
                    </button>
                  ) : null}
                </>
              )}
            </div>

            <aside className="p-5 sm:p-7">
              <h3 className="text-sm font-semibold text-ink">A few helpful details</h3>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
                <li>Share where and when the issue happened.</li>
                <li>Explain how it affected you or other students.</li>
                <li>Tell us what outcome would help.</li>
              </ul>
              <label className="mt-5 flex cursor-pointer gap-3 rounded-xl border border-line bg-white p-4 text-sm">
              <input
                checked={isAnonymous}
                className="mt-1 size-4 accent-brand"
                onChange={(event) => setIsAnonymous(event.target.checked)}
                type="checkbox"
              />
              <span>
                <span className="font-semibold text-ink">Submit anonymously</span>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  Campus administrators will see “Anonymous Student,” not your profile
                  details. Your signed-in account remains linked privately so you can
                  track this grievance. Avoid putting your name or contact details in
                  the grievance text. If you use AI, your messages are still sent to
                  Google Gemini.
                </span>
              </span>
              </label>
              <p className="mt-6 rounded-xl border border-line bg-canvas p-4 text-xs leading-5 text-muted">
                If you use AI, the text is sent to Google Gemini to prepare suggestions.
                Your report is visible to you and authorized campus administrators. Do not
                include passwords or unnecessary sensitive identifiers. If you submit
                anonymously, avoid identifying yourself in the grievance text.
              </p>
              {manualMode ? (
                <button
                  className="mt-5 text-sm font-semibold text-brand hover:underline"
                  onClick={() => {
                    setManualMode(false);
                    setFormError("");
                  }}
                  type="button"
                >
                  Try the AI assistant again
                </button>
              ) : null}
            </aside>
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <div className="flex flex-col gap-2 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">
              Your activity
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink">My grievances</h2>
          </div>
          <p className="text-sm text-muted">
            {complaints.length === 1 ? "1 saved grievance" : `${complaints.length} saved grievances`}
          </p>
        </div>
        {loading ? (
          <div className="py-12 text-center text-sm text-muted">Loading your grievances…</div>
        ) : loadError ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-sm text-red-800" role="alert">{loadError}</p>
            <button className="button-secondary mt-3" onClick={() => void refreshComplaints()}>
              Try again
            </button>
          </div>
        ) : complaints.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h3 className="font-semibold text-ink">Nothing submitted yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
              When you submit a grievance, its reference, status updates, and administrator
              responses will appear here.
            </p>
            <button className="button-primary mt-5" onClick={startGrievance}>
              Submit your first grievance
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {complaints.map((complaint) => (
              <details
                className="group rounded-2xl border border-line bg-white"
                key={complaint.id}
              >
                <summary className="flex cursor-pointer list-none flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-brand">
                        {complaint.reference}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(complaint.status)}`}>
                        {complaintStatusLabels[complaint.status]}
                      </span>
                      {complaint.isAnonymous ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          Anonymous
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 truncate font-semibold text-ink">{complaint.title}</h3>
                    <p className="mt-1 text-xs text-muted">Submitted {dateLabel(complaint.createdAt)}</p>
                  </div>
                  <span className="text-sm font-medium text-brand group-open:hidden">View details</span>
                  <span className="hidden text-sm font-medium text-brand group-open:inline">Hide details</span>
                </summary>
                <div className="grid gap-5 border-t border-line p-5 sm:grid-cols-2 sm:p-6">
                  <div>
                    <Link
                      className="mb-4 inline-flex text-sm font-semibold text-brand hover:underline"
                      href={`/student/complaints/${complaint.id}`}
                    >
                      Open full details and conversation
                    </Link>
                    <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">Description</h4>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{complaint.description}</p>
                    {complaint.assessment ? (
                      <div className="mt-5 rounded-xl bg-blue-50/80 p-4">
                        <h4 className="text-xs font-semibold text-blue-900">AI suggestions · staff review required</h4>
                        <p className="mt-2 text-sm leading-6 text-blue-900">{complaint.assessment.summary}</p>
                        <p className="mt-2 text-xs leading-5 text-blue-800">
                          Priority: {complaint.assessment.recommendedSeverity ?? "Not specified"}
                          {complaint.assessment.rationale
                            ? ` · ${complaint.assessment.rationale.replace(/\n/g, " · ")}`
                            : ""}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">Status updates</h4>
                      {complaint.statusHistory.length ? (
                        <ol className="mt-3 space-y-3">
                          {complaint.statusHistory.map((entry, index) => (
                            <li className="flex gap-3 text-sm" key={`${entry.toStatus}-${entry.createdAt}-${index}`}>
                              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
                              <span>
                                <span className="font-medium text-ink">
                                  {complaintStatusLabels[entry.toStatus as PortalComplaintStatus] ?? entry.toStatus}
                                </span>
                                <span className="ml-2 text-xs text-muted">{dateLabel(entry.createdAt)}</span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="mt-2 text-sm text-muted">No status updates yet.</p>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">Conversation</h4>
                      {complaint.responses.length ? (
                        <div className="mt-3 space-y-3">
                          {complaint.responses.map((response) => (
                            <article className="rounded-xl border border-line p-3" key={response.id}>
                              <p className="text-xs font-semibold text-brand">
                                {response.senderRole === "STUDENT" ? "You" : "Campus team"}
                              </p>
                              <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{response.body}</p>
                              <p className="mt-2 text-xs text-muted">{dateLabel(response.createdAt)}</p>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted">No administrator response yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </PortalShell>
  );
}
