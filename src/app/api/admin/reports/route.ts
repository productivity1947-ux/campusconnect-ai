import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { grievanceReference, severityLevels } from "@/lib/domain";
import { getRequestProfile, isAdministrator } from "@/server/auth";
import { prisma } from "@/server/db/client";
import { createAdminReportPdf } from "@/server/admin-report-pdf";
import { serializeAdminComplaint } from "@/server/admin-complaint-privacy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function dateInput(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

function countFor(
  counts: { status: string; count: number }[],
  status: string,
) {
  return counts.find((item) => item.status === status)?.count ?? 0;
}

export async function GET(request: Request) {
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

  const params = new URL(request.url).searchParams;
  const from = dateInput(params.get("from"));
  const to = dateInput(params.get("to"));
  if (
    !from ||
    !to ||
    from > to ||
    to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000
  ) {
    return NextResponse.json(
      { error: "Choose a valid date range of 366 days or fewer." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const toExclusive = new Date(to.getTime() + 24 * 60 * 60 * 1000);
  const where: Prisma.ComplaintWhereInput = {
    createdAt: { gte: from, lt: toExclusive },
  };
  try {
    const [
      complaints,
      statusGroups,
      priorityGroups,
      categoryGroups,
      categories,
      trendRows,
    ] = await Promise.all([
      prisma.complaint.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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
      }),
      prisma.complaint.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      prisma.complaint.groupBy({
        by: ["severity"],
        where,
        _count: { _all: true },
      }),
      prisma.complaint.groupBy({
        by: ["categoryId"],
        where: { ...where, categoryId: { not: null } },
        _count: { _all: true },
      }),
      prisma.complaintCategory.findMany({
        select: {
          id: true,
          name: true,
          departmentId: true,
          department: { select: { name: true } },
        },
      }),
      prisma.$queryRaw<Array<{ day: string; count: number }>>`
        SELECT
          to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
          count(*)::int AS count
        FROM public.complaints
        WHERE created_at >= ${from} AND created_at < ${toExclusive}
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    const statusCounts = statusGroups.map((item) => ({
      status: item.status,
      count: item._count._all,
    }));
    const priorityCounts: Record<string, number> = Object.fromEntries(
      [...severityLevels, "UNASSIGNED"].map((severity) => [severity, 0]),
    );
    for (const item of priorityGroups) {
      priorityCounts[item.severity ?? "UNASSIGNED"] = item._count._all;
    }

    const categoryById = new Map(
      categories.map((category) => [category.id, category]),
    );
    const categoryCounts = new Map<string, number>();
    const departmentCounts = new Map<string, number>();
    for (const item of categoryGroups) {
      if (!item.categoryId) continue;
      categoryCounts.set(item.categoryId, item._count._all);
      const department = categoryById.get(item.categoryId)?.department;
      if (department) {
        departmentCounts.set(
          department.name,
          (departmentCounts.get(department.name) ?? 0) + item._count._all,
        );
      }
    }

    const lines = [
      `Total complaints: ${complaints.length}`,
      `Pending: ${countFor(statusCounts, "SUBMITTED")}`,
      `In progress: ${
        countFor(statusCounts, "IN_PROGRESS") +
        countFor(statusCounts, "TRIAGED") +
        countFor(statusCounts, "WAITING_FOR_STUDENT") +
        countFor(statusCounts, "REOPENED")
      }`,
      `Resolved: ${countFor(statusCounts, "RESOLVED")}`,
      `Closed: ${countFor(statusCounts, "CLOSED")}`,
      `Rejected: ${countFor(statusCounts, "REJECTED")}`,
      "",
      "PRIORITY BREAKDOWN",
      ...[...severityLevels, "UNASSIGNED"].map(
        (severity) => `${severity}: ${priorityCounts[severity]}`,
      ),
      "",
      "STATUS BREAKDOWN",
      ...statusCounts.map((item) => `${item.status}: ${item.count}`),
      "",
      "DEPARTMENT BREAKDOWN",
      ...(departmentCounts.size
        ? [...departmentCounts].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => `${name}: ${count}`)
        : ["No department data in this period."]),
      "",
      "CATEGORY BREAKDOWN",
      ...(categoryCounts.size
        ? [...categoryCounts]
            .map(([id, count]) => ({
              name: categoryById.get(id)?.name ?? "Unknown category",
              count,
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((item) => `${item.name}: ${item.count}`)
        : ["No category data in this period."]),
      "",
      "COMPLAINT TREND BY DAY (UTC)",
      ...(trendRows.length
        ? trendRows.map((item) => `${item.day}: ${item.count}`)
        : ["No complaints were submitted during this period."]),
      "",
      "COMPLAINT DETAILS",
    ];

    if (!complaints.length) {
      lines.push("No complaints were submitted during this period.");
    }
    for (const complaint of complaints) {
      const reportComplaint = serializeAdminComplaint(
        complaint,
        grievanceReference(complaint.id, complaint.createdAt),
      );
      const reporter = reportComplaint.student
        ? `${reportComplaint.student.displayName ?? "Student"} (${reportComplaint.student.email})`
        : "Anonymous Student";
      const priority =
        reportComplaint.severity ??
        reportComplaint.assessment?.recommendedSeverity ??
        "Unassigned";
      lines.push(
        "",
        `${reportComplaint.reference} | ${reportComplaint.status} | ${priority} | ${complaint.createdAt.toISOString().slice(0, 10)}`,
        `Reporter: ${reporter}`,
        `Title: ${reportComplaint.title}`,
        `Category: ${reportComplaint.category?.name ?? "Not assigned"} | Department: ${reportComplaint.category?.department?.name ?? "Not assigned"}`,
        `Details: ${(reportComplaint.description || "").replace(/\s+/g, " ").slice(0, 360)}`,
      );
    }

    const pdf = createAdminReportPdf({
      title: "Grievance Report",
      period: `${params.get("from")} through ${params.get("to")}`,
      generatedAt: new Date(),
      lines,
    });
    const filename = `campusconnect-report-${params.get("from")}-${params.get("to")}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "Administrator report generation failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "The report could not be generated. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
