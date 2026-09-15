import { requirePageAccess } from "@/lib/page-access";
import StudentsReportClient from "./students-client";

export default async function StudentsReportPage() {
  await requirePageAccess("/dashboard/reports/students");
  return <StudentsReportClient />;
}
