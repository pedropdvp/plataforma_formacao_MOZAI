import { requirePageAccess } from "@/lib/page-access";
import EmployeesReportClient from "./employees-client";

export default async function EmployeesReportPage() {
  await requirePageAccess("/dashboard/reports/employees");
  return <EmployeesReportClient />;
}
