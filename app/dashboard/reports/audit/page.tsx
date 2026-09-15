import { requirePageAccess } from "@/lib/page-access";
import AuditReportClient from "./audit-client";

export default async function AuditReportPage() {
  await requirePageAccess("/dashboard/reports/audit");
  return <AuditReportClient />;
}
