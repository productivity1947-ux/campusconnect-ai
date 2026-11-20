type AdminComplaintRecord = {
  id: string;
  title: string;
  description: string;
  status: string;
  severity: string | null;
  urgency: string | null;
  isAnonymous: boolean;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; email: string; displayName: string | null };
  category: { name: string; department: { name: string } | null } | null;
  aiAssessments: {
    summary: string | null;
    rationale: string | null;
    recommendedSeverity: string | null;
    recommendedUrgency: string | null;
    reviewStatus: string;
  }[];
  statusHistory: {
    fromStatus: string | null;
    toStatus: string;
    createdAt: Date;
  }[];
  responses: {
    id: string;
    body: string;
    createdAt: Date;
    author: { role: string };
  }[];
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactIdentity(text: string | null, identities: string[]) {
  if (!text) return text;
  return identities.reduce((result, identity) => {
    const escaped = escapeRegExp(identity);
    const expression =
      identity.includes("@") || /^[0-9a-f-]{36}$/i.test(identity)
        ? new RegExp(escaped, "gi")
        : new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "giu");
    return result.replace(expression, "[redacted]");
  }, text);
}

export function serializeAdminComplaint(
  complaint: AdminComplaintRecord,
  reference: string,
) {
  const identities = complaint.isAnonymous
    ? [
        complaint.student.email,
        complaint.student.id,
        complaint.student.displayName ?? "",
      ].filter((value) => value.trim().length > 0)
    : [];
  const redact = (value: string | null) => redactIdentity(value, identities);

  return {
    id: complaint.id,
    reference,
    title: redact(complaint.title) ?? "",
    description: redact(complaint.description) ?? "",
    status: complaint.status,
    severity: complaint.severity,
    urgency: complaint.urgency,
    isAnonymous: complaint.isAnonymous,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
    student: complaint.isAnonymous
      ? null
      : {
          email: complaint.student.email,
          displayName: complaint.student.displayName,
        },
    category: complaint.category,
    assessment: complaint.aiAssessments[0]
      ? {
          ...complaint.aiAssessments[0],
          summary: redact(complaint.aiAssessments[0].summary),
          rationale: redact(complaint.aiAssessments[0].rationale),
        }
      : null,
    statusHistory: complaint.statusHistory,
    responses: complaint.responses.map((response) => ({
      id: response.id,
      senderRole: response.author.role === "STUDENT" ? "STUDENT" : "ADMIN",
      body: redact(response.body) ?? "",
      createdAt: response.createdAt,
    })),
  };
}
