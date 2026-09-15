import { requirePageAccess } from "@/lib/page-access";
import ComplianceClient from "./compliance-client";

export default async function CompliancePage() {
  await requirePageAccess("/dashboard/admin/compliance");
  return <ComplianceClient />;
}
