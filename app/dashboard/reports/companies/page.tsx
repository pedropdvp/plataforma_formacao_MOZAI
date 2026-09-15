import { requirePageAccess } from "@/lib/page-access";
import CompaniesReportClient from "./companies-client";

export default async function CompaniesReportPage() {
  await requirePageAccess("/dashboard/reports/companies");
  return <CompaniesReportClient />;
}
