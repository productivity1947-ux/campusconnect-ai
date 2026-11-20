import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import {
  isComplaintStatus,
  isSeverityLevel,
  grievanceReference,
  severityLevels,
} from "@/lib/domain";
import { getRequestProfile, isAdministrator } from "@/server/auth";
import { prisma } from "@/server/db/client";
import { serializeAdminComplaint } from "@/server/admin-complaint-privacy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function referenceId(value: string) {
  const match = value.match(/^CC-\d{4}-([0-9a-f]{32})$/i);
  if (!match) return null;
  const hex = match[1];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function dateInput(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
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

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const requestedStatus = url.searchParams.get("status");
  const requestedSeverity = url.searchParams.get("severity");
  const categoryId = url.searchParams.get("category") ?? "";
  const departmentId = url.searchParams.get("department") ?? "";
  const sort = url.searchParams.get("sort") ?? "newest";
  const pageText = url.searchParams.get("page") ?? "1";
  const fromText = url.searchParams.get("from");
  const toText = url.searchParams.get("to");
  const today = new Date();
  const defaultTo = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const defaultFrom = new Date(defaultTo);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  const fromDate = fromText ? dateInput(fromText) : defaultFrom;
  const toDate = toText ? dateInput(toText) : defaultTo;
  if (
    (requestedStatus && !isComplaintStatus(requestedStatus)) ||
    (requestedSeverity && !isSeverityLevel(requestedSeverity)) ||
    (categoryId && !uuidPattern.test(categoryId)) ||
    (departmentId && !uuidPattern.test(departmentId)) ||
    !["newest", "oldest"].includes(sort) ||
    !/^[1-9]\d*$/.test(pageText) ||
    Number(pageText) > 10000 ||
    (fromText !== null && !fromDate) ||
    (toText !== null && !toDate) ||
    !fromDate ||
    !toDate ||
    fromDate > toDate ||
    toDate.getTime() - fromDate.getTime() > 366 * 24 * 60 * 60 * 1000
  ) {
    return NextResponse.json(
      { error: "One or more grievance filters are invalid." },
      { status: 400 },
    );
  }

  const page = Number(pageText);
  const pageSize = 25;
  const toExclusive = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);
  const rangeFilter = { createdAt: { gte: fromDate, lt: toExclusive } };
  const id = referenceId(query);
  try {
    const statusFilter = isComplaintStatus(requestedStatus)
      ? requestedStatus
      : undefined;
    const severityFilter = isSeverityLevel(requestedSeverity)
      ? requestedSeverity
      : undefined;
    const identitySearch = query
      ? await prisma.userProfile.findFirst({
          where: {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              { displayName: { contains: query, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        })
      : null;
    const searchFilters: Prisma.ComplaintWhereInput[] = [];
    if (id) searchFilters.push({ id });
    if (query && !identitySearch) {
      searchFilters.push(
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      );
    }
    if (query) {
      searchFilters.push({
        isAnonymous: false,
        student: {
          is: {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              { displayName: { contains: query, mode: "insensitive" } },
            ],
          },
        },
      });
    }
    const analyticsWhere: Prisma.ComplaintWhereInput = {
      ...rangeFilter,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(severityFilter ? { severity: severityFilter } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(departmentId ? { category: { is: { departmentId } } } : {}),
    };
    const where: Prisma.ComplaintWhereInput = {
      ...analyticsWhere,
      ...(searchFilters.length ? { OR: searchFilters } : {}),
    };
    const overdueWhere: Prisma.ComplaintWhereInput = {
      AND: [
        analyticsWhere,
        {
          createdAt: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          ...(statusFilter
            ? { status: statusFilter }
            : { status: { notIn: ["RESOLVED", "REJECTED", "CLOSED"] } }),
        },
      ],
    };
    const [
      complaints,
      statusCounts,
      matchCount,
      total,
      categories,
      departments,
      categoryCounts,
      priorityCounts,
      overdue,
      trendRows,
    ] = await Promise.all([
      prisma.complaint.findMany({
        where,
        orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
        where: analyticsWhere,
        _count: { _all: true },
      }),
      prisma.complaint.count({ where }),
      prisma.complaint.count({ where: analyticsWhere }),
      prisma.complaintCategory.findMany({
        select: { id: true, name: true, departmentId: true, isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        select: { id: true, name: true, isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.complaint.groupBy({
        by: ["categoryId"],
        where: { AND: [analyticsWhere, { categoryId: { not: null } }] },
        _count: { _all: true },
      }),
      prisma.complaint.groupBy({
        by: ["severity"],
        where: analyticsWhere,
        _count: { _all: true },
      }),
      prisma.complaint.count({ where: overdueWhere }),
      prisma.$queryRaw<Array<{ day: string; count: number }>>`
        SELECT
          to_char(date_trunc('day', complaint.created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
          count(*)::int AS count
        FROM public.complaints AS complaint
        LEFT JOIN public.complaint_categories AS category
          ON category.id = complaint.category_id
        WHERE complaint.created_at >= ${fromDate}
          AND complaint.created_at < ${toExclusive}
          AND (${statusFilter ?? null}::text IS NULL OR complaint.status::text = ${statusFilter ?? null})
          AND (${severityFilter ?? null}::text IS NULL OR complaint.severity::text = ${severityFilter ?? null})
          AND (${categoryId || null}::uuid IS NULL OR complaint.category_id = ${categoryId || null}::uuid)
          AND (${departmentId || null}::uuid IS NULL OR category.department_id = ${departmentId || null}::uuid)
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const categoryDepartment = new Map(
      categories.map((category) => [category.id, category.departmentId]),
    );
    const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
    const byCategory: Record<string, { name: string; count: number }> = {};
    const byDepartment: Record<string, { name: string; count: number }> = {};
    const byPriority: Record<string, number> = Object.fromEntries(
      [...severityLevels, "UNASSIGNED"].map((severity) => [severity, 0]),
    );
    for (const item of categoryCounts) {
      if (!item.categoryId) continue;
      const categoryName = categoryNames.get(item.categoryId);
      if (categoryName) {
        byCategory[item.categoryId] = { name: categoryName, count: item._count._all };
      }
      const departmentIdForCategory = categoryDepartment.get(item.categoryId);
      const departmentName = departmentIdForCategory
        ? departmentNames.get(departmentIdForCategory)
        : undefined;
      if (departmentIdForCategory && departmentName) {
        const current = byDepartment[departmentIdForCategory];
        byDepartment[departmentIdForCategory] = {
          name: departmentName,
          count: (current?.count ?? 0) + item._count._all,
        };
      }
    }
    for (const item of priorityCounts) {
      byPriority[item.severity ?? "UNASSIGNED"] = item._count._all;
    }

    const resolved = statusCounts.find((item) => item.status === "RESOLVED")?._count._all ?? 0;
    const closed = statusCounts.find((item) => item.status === "CLOSED")?._count._all ?? 0;
    const inProgress =
      (statusCounts.find((item) => item.status === "TRIAGED")?._count._all ?? 0) +
      (statusCounts.find((item) => item.status === "IN_PROGRESS")?._count._all ?? 0) +
      (statusCounts.find((item) => item.status === "WAITING_FOR_STUDENT")?._count._all ?? 0) +
      (statusCounts.find((item) => item.status === "REOPENED")?._count._all ?? 0);

    return NextResponse.json(
      {
        complaints: complaints.map((complaint) =>
          serializeAdminComplaint(
            complaint,
            grievanceReference(complaint.id, complaint.createdAt),
          ),
        ),
        counts: {
          total,
          byStatus: Object.fromEntries(
            statusCounts.map((item) => [item.status, item._count._all]),
          ),
          byPriority,
          byCategory,
          byDepartment,
          resolved,
          unresolved: total - resolved,
          inProgress,
          closed,
          overdue,
          trend: trendRows,
        },
        dateRange: {
          from: fromDate.toISOString().slice(0, 10),
          to: toDate.toISOString().slice(0, 10),
        },
        pagination: {
          page,
          pageSize,
          total: matchCount,
          pageCount: Math.max(1, Math.ceil(matchCount / pageSize)),
        },
        filters: {
          categories: categories.filter((category) => category.isActive).map(({ id: categoryIdValue, name }) => ({
            id: categoryIdValue,
            name,
          })),
          departments: departments
            .filter((department) => department.isActive)
            .map(({ id: departmentIdValue, name }) => ({
              id: departmentIdValue,
              name,
            })),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Administrator grievance list failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "The grievance queue could not be loaded. Please try again." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
