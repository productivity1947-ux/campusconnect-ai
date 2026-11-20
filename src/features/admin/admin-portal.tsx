"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/layout/portal-shell";
import { PortalGuard } from "@/features/auth/portal-guard";
import { useAuth } from "@/features/auth/auth-provider";
import { useRef } from "react";
import {
  complaintStatusLabels,
  complaintStatuses,
  isSeverityLevel,
  severityLevels,
  type PortalComplaintStatus,
} from "@/lib/domain";

type AdminComplaint = {
  id: string;
  reference: string;
  title: string;
  description: string;
  status: PortalComplaintStatus;
  severity: string | null;
  urgency: string | null;
  isAnonymous: boolean;
  createdAt: string;
  updatedAt: string;
  student: { email: string; displayName: string | null } | null;
  category: { name: string; department: { name: string } | null } | null;
  assessment: {
    summary: string | null;
    rationale: string | null;
    recommendedSeverity: string | null;
    recommendedUrgency: string | null;
    reviewStatus: string;
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

type AdminData = {
  complaints: AdminComplaint[];
  counts: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byCategory: Record<string, { name: string; count: number }>;
    byDepartment: Record<string, { name: string; count: number }>;
    resolved: number;
    unresolved: number;
    inProgress: number;
    closed: number;
    overdue: number;
    trend: { day: string; count: number }[];
  };
  dateRange: { from: string; to: string };
  pagination: { page: number; pageSize: number; total: number; pageCount: number };
  filters: {
    categories: { id: string; name: string }[];
    departments: { id: string; name: string }[];
  };
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function rangeStart(days: number) {
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - days + 1);
  return dateInputValue(start);
}

function monthStart() {
  const now = new Date();
  return dateInputValue(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}

function AnalyticsBarChart({
  title,
  entries,
}: {
  title: string;
  entries: { label: string; value: number }[];
}) {
  const maximum = Math.max(1, ...entries.map((entry) => entry.value));
  return (
    <article className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {entries.length ? (
        <ul className="mt-4 space-y-3">
          {entries.map((entry) => (
            <li key={entry.label}>
              <div className="mb-1 flex justify-between gap-3 text-xs">
                <span className="truncate text-muted">{entry.label}</span>
                <span className="font-semibold text-ink">{entry.value}</span>
              </div>
              <div
                aria-label={`${entry.label}: ${entry.value}`}
                className="h-2 overflow-hidden rounded-full bg-slate-100"
                role="img"
              >
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${(entry.value / maximum) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">No records for this period.</p>
      )}
    </article>
  );
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

function selectedPriority(value: string | null | undefined) {
  return isSeverityLevel(value) ? value : "";
}

export function AdminPortal() {
  return (
    <PortalGuard role="admin">
      <AdminDashboard />
    </PortalGuard>
  );
}

function AdminDashboard() {
  const { profile, session } = useAuth();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [dateMode, setDateMode] = useState<"weekly" | "monthly" | "custom">("monthly");
  const [dateFrom, setDateFrom] = useState(() => monthStart());
  const [dateTo, setDateTo] = useState(() => dateInputValue(new Date()));
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<PortalComplaintStatus>("SUBMITTED");
  const [editSeverity, setEditSeverity] = useState<(typeof severityLevels)[number] | "">("");
  const [responseText, setResponseText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportNotice, setReportNotice] = useState("");
  const token = session?.access_token;
  const selectedIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (departmentFilter) params.set("department", departmentFilter);
    if (severityFilter) params.set("severity", severityFilter);
    params.set("from", dateFrom);
    params.set("to", dateTo);
    params.set("page", String(page));
    params.set("sort", sortOrder);
    try {
      const response = await fetch(`/api/admin/complaints?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = (await response.json()) as AdminData & { error?: string };
      if (!response.ok || !body.complaints || !body.counts) {
        throw new Error(body.error ?? "The grievance queue could not be loaded.");
      }
      setData(body);
      const nextSelected =
        body.complaints.find((item) => item.id === selectedIdRef.current) ??
        body.complaints[0] ??
        null;
      if (nextSelected?.id !== selectedIdRef.current) {
        selectedIdRef.current = nextSelected?.id ?? null;
        setSelectedId(nextSelected?.id ?? null);
        setEditStatus(nextSelected?.status ?? "SUBMITTED");
        setEditSeverity(selectedPriority(nextSelected?.severity));
        setResponseText("");
        setSaveError("");
      } else if (nextSelected) {
        setEditStatus(nextSelected.status);
        setEditSeverity(selectedPriority(nextSelected.severity));
      }
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "The grievance queue could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    categoryFilter,
    dateFrom,
    dateTo,
    departmentFilter,
    page,
    query,
    severityFilter,
    sortOrder,
    statusFilter,
    token,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 250);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const selected = useMemo(
    () => data?.complaints.find((item) => item.id === selectedId) ?? null,
    [data?.complaints, selectedId],
  );

  async function saveUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selected) return;
    if (
      editStatus === selected.status &&
      (!editSeverity || editSeverity === selected.severity) &&
      !responseText.trim()
    ) {
      setSaveError("Change the status or priority, or write a student-visible response.");
      return;
    }
    if (
      editStatus !== selected.status &&
      ["CLOSED", "REJECTED"].includes(editStatus) &&
      !window.confirm("Close this grievance? The student will no longer be able to reply.")
    ) {
      return;
    }

    setSaving(true);
    setSaveError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/complaints/${selected.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: editStatus === selected.status ? undefined : editStatus,
          severity:
            editSeverity && editSeverity !== selected.severity
              ? editSeverity
              : undefined,
          response: responseText.trim() || undefined,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "The update could not be saved.");
      }
      setNotice("Grievance updated. The student can now see the status and response.");
      setResponseText("");
      await refresh();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "The update could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function downloadReport() {
    if (!token) return;
    setReportLoading(true);
    setReportError("");
    setReportNotice("");
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo });
      const response = await fetch(`/api/admin/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "The PDF report could not be generated.");
      }
      const pdf = await response.blob();
      if (pdf.type !== "application/pdf" || pdf.size === 0) {
        throw new Error("The report response was not a valid PDF.");
      }
      const url = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = url;
      link.download = `campusconnect-report-${dateFrom}-${dateTo}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setReportNotice("The report was generated and downloaded.");
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : "The PDF report could not be generated.",
      );
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <PortalShell
      role="admin"
      title="Grievance dashboard"
      description="Review student-submitted concerns, make the final status decision, and send visible responses."
    >
      <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Administrator: <span className="font-medium text-ink">{profile?.email}</span>
        </p>
        <span className="w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
          Authorized campus staff
        </span>
      </div>

      <section className="mb-6 rounded-2xl border border-line bg-white p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block text-xs font-semibold text-muted">
            Reporting period
            <select
              className="form-input mt-2"
              onChange={(event) => {
                const nextMode = event.target.value as typeof dateMode;
                setDateMode(nextMode);
                setPage(1);
                if (nextMode === "weekly") setDateFrom(rangeStart(7));
                if (nextMode === "monthly") setDateFrom(monthStart());
              }}
              value={dateMode}
            >
              <option value="weekly">Weekly · last 7 days</option>
              <option value="monthly">Monthly · current month</option>
              <option value="custom">Custom date range</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-muted">
            From
            <input
              className="form-input mt-2"
              max={dateTo}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setDateMode("custom");
                setPage(1);
              }}
              type="date"
              value={dateFrom}
            />
          </label>
          <label className="block text-xs font-semibold text-muted">
            Through
            <input
              className="form-input mt-2"
              min={dateFrom}
              onChange={(event) => {
                setDateTo(event.target.value);
                setDateMode("custom");
                setPage(1);
              }}
              type="date"
              value={dateTo}
            />
          </label>
          <div className="flex items-end">
            <p className="pb-3 text-xs leading-5 text-muted">
              Counts and charts use saved complaints in the selected UTC date range.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Live grievance counts" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Total complaints", value: data?.counts.total },
          { label: "Pending", value: data?.counts.byStatus.SUBMITTED ?? 0 },
          { label: "In progress", value: data?.counts.inProgress ?? 0 },
          { label: "Resolved", value: data?.counts.resolved ?? 0 },
          { label: "Closed", value: data?.counts.closed ?? 0 },
          { label: "Overdue · open >7 days", value: data?.counts.overdue ?? 0 },
        ].map((item) => (
          <article className="rounded-2xl border border-line bg-white p-5" key={item.label}>
            <p className="text-sm font-medium text-muted">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              {loading && !data ? "—" : (item.value ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted">Selected period · live data</p>
          </article>
        ))}
      </section>

      {data && (
        <section aria-label="Complaint analytics" className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <AnalyticsBarChart
            title="Complaints by priority"
            entries={[...severityLevels, "UNASSIGNED"].map((severity) => ({
              label: severity === "UNASSIGNED" ? "Not assigned" : severity,
              value: data.counts.byPriority[severity] ?? 0,
            }))}
          />
          <AnalyticsBarChart
            title="Complaints by status"
            entries={Object.entries(data.counts.byStatus).map(([status, value]) => ({
              label: complaintStatusLabels[status as PortalComplaintStatus] ?? status,
              value,
            }))}
          />
          <AnalyticsBarChart
            title="Resolved vs. unresolved"
            entries={[
              { label: "Resolved", value: data.counts.resolved },
              { label: "Unresolved", value: data.counts.unresolved },
            ]}
          />
          <AnalyticsBarChart
            title="Complaints by department"
            entries={Object.values(data.counts.byDepartment).map((item) => ({
              label: item.name,
              value: item.count,
            }))}
          />
          <AnalyticsBarChart
            title="Complaints by category"
            entries={Object.values(data.counts.byCategory).map((item) => ({
              label: item.name,
              value: item.count,
            }))}
          />
          <AnalyticsBarChart
            title="Complaints over time"
            entries={data.counts.trend.map((item) => ({
              label: item.day,
              value: item.count,
            }))}
          />
        </section>
      )}

      <section className="mt-5 flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-ink">Reports</h2>
          <p className="mt-1 text-sm text-muted">
            Download a PDF for {dateFrom} through {dateTo}. Anonymous identities are omitted and redacted.
          </p>
          {reportError ? <p className="mt-2 text-sm text-red-700" role="alert">{reportError}</p> : null}
          {reportNotice ? <p className="mt-2 text-sm text-emerald-800" role="status">{reportNotice}</p> : null}
        </div>
        <button
          className="button-primary shrink-0"
          disabled={reportLoading || !dateFrom || !dateTo || dateFrom > dateTo}
          onClick={() => void downloadReport()}
          type="button"
        >
          {reportLoading ? "Generating PDF…" : `Download ${dateMode} PDF`}
        </button>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
        <div className="min-w-0 rounded-2xl border border-line bg-white">
          <div className="border-b border-line p-4 sm:p-5">
            <h2 className="font-semibold text-ink">Grievance queue</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="sr-only" htmlFor="complaint-search">Search grievances</label>
              <input
                className="form-input"
                id="complaint-search"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search reference, title, details, or student"
                value={query}
              />
              <label className="sr-only" htmlFor="status-filter">Filter by status</label>
              <select
                className="form-input"
                id="status-filter"
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                value={statusFilter}
              >
                <option value="">All statuses</option>
                {complaintStatuses.map((status) => (
                  <option key={status} value={status}>{complaintStatusLabels[status]}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="priority-filter">Filter by priority</label>
              <select
                className="form-input"
                id="priority-filter"
                onChange={(event) => {
                  setSeverityFilter(event.target.value);
                  setPage(1);
                }}
                value={severityFilter}
              >
                <option value="">All priorities</option>
                {severityLevels.map((severity) => (
                  <option key={severity} value={severity}>{severity}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="category-filter">Filter by category</label>
              <select
                className="form-input"
                id="category-filter"
                onChange={(event) => {
                  setCategoryFilter(event.target.value);
                  setPage(1);
                }}
                value={categoryFilter}
              >
                <option value="">All categories</option>
                {data?.filters.categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="department-filter">Filter by department</label>
              <select
                className="form-input"
                id="department-filter"
                onChange={(event) => {
                  setDepartmentFilter(event.target.value);
                  setPage(1);
                }}
                value={departmentFilter}
              >
                <option value="">All departments</option>
                {data?.filters.departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="sort-order">Sort by submission date</label>
              <select
                className="form-input"
                id="sort-order"
                onChange={(event) => {
                  setSortOrder(event.target.value as "newest" | "oldest");
                  setPage(1);
                }}
                value={sortOrder}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
          <div className="max-h-[720px] overflow-y-auto p-3">
            {loading && !data ? (
              <p className="p-6 text-center text-sm text-muted">Loading grievances…</p>
            ) : loadError ? (
              <div className="p-5">
                <p className="text-sm text-red-700" role="alert">{loadError}</p>
                <button className="button-secondary mt-3" onClick={() => void refresh()}>
                  Try again
                </button>
              </div>
            ) : !data?.complaints.length ? (
              <div className="p-8 text-center">
                <h3 className="font-semibold text-ink">No grievances found</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  New student submissions will appear here. Counts reflect saved records only.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.complaints.map((item) => (
                  <button
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selectedId === item.id
                        ? "border-blue-300 bg-blue-50/60"
                        : "border-transparent hover:border-line hover:bg-canvas"
                    }`}
                    key={item.id}
                    onClick={() => {
                      selectedIdRef.current = item.id;
                      setSelectedId(item.id);
                      setEditStatus(item.status);
                      setEditSeverity(selectedPriority(item.severity));
                      setResponseText("");
                      setSaveError("");
                      setNotice("");
                    }}
                    type="button"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-brand">
                        {item.reference}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(item.status)}`}>
                        {complaintStatusLabels[item.status]}
                      </span>
                    </div>
                    <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-1 truncate text-xs text-muted">
                      {item.isAnonymous
                        ? "Anonymous Student"
                        : item.student?.displayName || item.student?.email || "Student"}
                      {" · "}{dateLabel(item.createdAt)}
                    </p>
                    {item.category ? (
                      <p className="mt-1 truncate text-xs text-muted">
                        {item.category.name}
                        {item.category.department ? ` · ${item.category.department.name}` : ""}
                      </p>
                    ) : null}
                    {item.assessment?.recommendedSeverity ? (
                      <span className="mt-2 inline-flex rounded-md bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-800">
                        AI priority suggestion: {item.assessment.recommendedSeverity}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
          {data?.pagination ? (
            <div className="flex items-center justify-between border-t border-line px-4 py-3">
              <p className="text-xs text-muted">
                Page {data.pagination.page} of {data.pagination.pageCount} · {data.pagination.total} complaints
              </p>
              <div className="flex gap-2">
                <button
                  className="button-secondary px-3 py-2 text-xs"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="button-secondary px-3 py-2 text-xs"
                  disabled={page >= data.pagination.pageCount || loading}
                  onClick={() => setPage((current) => Math.min(data.pagination.pageCount, current + 1))}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          {!selected ? (
            <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-muted">
              Select a grievance to review its details.
            </div>
          ) : (
            <article className="rounded-2xl border border-line bg-white">
              <div className="border-b border-line p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-brand">{selected.reference}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(selected.status)}`}>
                    {complaintStatusLabels[selected.status]}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-semibold text-ink">{selected.title}</h2>
                <p className="mt-2 text-sm text-muted">
                  {selected.isAnonymous
                    ? "Anonymous Student"
                    : `${selected.student?.displayName || "Student"}${selected.student?.email ? ` · ${selected.student.email}` : ""}`}
                  {" · Submitted "}{dateLabel(selected.createdAt)}
                </p>
                {selected.category ? (
                  <p className="mt-2 text-sm text-muted">
                    {selected.category.name}
                    {selected.category.department ? ` · ${selected.category.department.name}` : ""}
                  </p>
                ) : null}
              </div>
              <div className="space-y-6 p-5 sm:p-6">
                <section>
                  <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Student description</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink">{selected.description}</p>
                </section>

                <section className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                  <h3 className="text-sm font-semibold text-blue-950">AI suggestions (not a decision)</h3>
                  {selected.assessment ? (
                    <>
                      <p className="mt-2 text-sm leading-6 text-blue-950">{selected.assessment.summary}</p>
                      <p className="mt-2 text-xs leading-5 text-blue-900">
                        Priority: {selected.assessment.recommendedSeverity ?? "Not suggested"}
                        {selected.assessment.recommendedUrgency
                          ? ` · Urgency: ${selected.assessment.recommendedUrgency}`
                          : ""}
                      </p>
                      {selected.assessment.rationale ? (
                        <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-blue-900">
                          {selected.assessment.rationale}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-blue-900">
                      No AI assessment was saved for this grievance.
                    </p>
                  )}
                  <p className="mt-3 text-xs leading-5 text-blue-900">
                    Review all details and make the status decision yourself.
                  </p>
                </section>

                <section>
                  <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                    Student-visible conversation
                  </h3>
                  {selected.responses.length ? (
                    <div className="mt-3 space-y-3">
                      {selected.responses.map((response) => (
                        <div className="rounded-xl border border-line p-3" key={response.id}>
                          <p className="text-xs font-semibold text-brand">
                            {response.senderRole === "STUDENT" ? "Student" : "Campus team"}
                          </p>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{response.body}</p>
                          <p className="mt-2 text-xs text-muted">{dateLabel(response.createdAt)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted">No response has been sent yet.</p>
                  )}
                </section>

                <form className="space-y-4 border-t border-line pt-5" onSubmit={saveUpdate}>
                  <h3 className="font-semibold text-ink">Update grievance</h3>
                  {["CLOSED", "RESOLVED", "REJECTED"].includes(selected.status) ? (
                    <button
                      className="button-secondary"
                      onClick={() => setEditStatus("REOPENED")}
                      type="button"
                    >
                      Reopen grievance
                    </button>
                  ) : null}
                  <label className="block text-sm font-medium text-ink">
                    Status
                    <select
                      className="form-input mt-2"
                      onChange={(event) =>
                        setEditStatus(event.target.value as PortalComplaintStatus)
                      }
                      value={editStatus}
                    >
                      {complaintStatuses.map((status) => (
                        <option key={status} value={status}>
                          {complaintStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    Priority
                    <select
                      className="form-input mt-2"
                      onChange={(event) => {
                        const value = event.target.value;
                        setEditSeverity(isSeverityLevel(value) ? value : "");
                      }}
                      value={editSeverity}
                    >
                      <option value="">
                        {selected.severity ? `Keep current (${selected.severity})` : "Not assigned"}
                      </option>
                      {severityLevels.map((severity) => (
                        <option key={severity} value={severity}>{severity}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-ink">
                    Response to student
                    <textarea
                      className="form-input mt-2 min-h-28 resize-y"
                      maxLength={5000}
                      onChange={(event) => setResponseText(event.target.value)}
                      placeholder="Write an update the student will be able to see."
                      value={responseText}
                    />
                  </label>
                  {saveError ? (
                    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                      {saveError}
                    </p>
                  ) : null}
                  {notice ? (
                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
                      {notice}
                    </p>
                  ) : null}
                  <button className="button-primary" disabled={saving}>
                    {saving ? "Saving…" : "Save status and response"}
                  </button>
                </form>

                <section className="border-t border-line pt-5">
                  <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">Status history</h3>
                  <ol className="mt-3 space-y-3">
                    {selected.statusHistory.map((entry, index) => (
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
                </section>
              </div>
            </article>
          )}
        </div>
      </section>
    </PortalShell>
  );
}
