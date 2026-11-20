export const complaintStatuses = [
  "SUBMITTED",
  "TRIAGED",
  "IN_PROGRESS",
  "WAITING_FOR_STUDENT",
  "REOPENED",
  "RESOLVED",
  "CLOSED",
  "REJECTED",
] as const;

export type PortalComplaintStatus = (typeof complaintStatuses)[number];

export const complaintStatusLabels: Record<PortalComplaintStatus, string> = {
  SUBMITTED: "Submitted",
  TRIAGED: "Under review",
  IN_PROGRESS: "In progress",
  WAITING_FOR_STUDENT: "Awaiting student response",
  REOPENED: "Reopened",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

export const severityLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type SeverityLevel = (typeof severityLevels)[number];

export const urgencyLevels = ["ROUTINE", "SOON", "URGENT", "IMMEDIATE"] as const;
export type UrgencyLevel = (typeof urgencyLevels)[number];

export function isComplaintStatus(value: unknown): value is PortalComplaintStatus {
  return (
    typeof value === "string" &&
    complaintStatuses.includes(value as PortalComplaintStatus)
  );
}

export function isSeverityLevel(value: unknown): value is SeverityLevel {
  return (
    typeof value === "string" && severityLevels.includes(value as SeverityLevel)
  );
}

export function isUrgencyLevel(value: unknown): value is UrgencyLevel {
  return (
    typeof value === "string" && urgencyLevels.includes(value as UrgencyLevel)
  );
}

export function grievanceReference(id: string, createdAt: Date | string) {
  const year = new Date(createdAt).getUTCFullYear();
  return `CC-${year}-${id.replaceAll("-", "").toUpperCase()}`;
}
