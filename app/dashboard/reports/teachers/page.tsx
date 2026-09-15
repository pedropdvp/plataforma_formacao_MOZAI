import { requirePageAccess } from "@/lib/page-access";
import TeachersReportClient from "./teachers-client";

export default async function TeachersReportPage() {
  await requirePageAccess("/dashboard/reports/teachers");
  return <TeachersReportClient />;
}
