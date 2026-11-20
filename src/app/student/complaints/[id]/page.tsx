import { StudentComplaintDetail } from "@/features/student/student-complaint-detail";

export default async function StudentComplaintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudentComplaintDetail id={id} />;
}
