import { requirePageAccess } from "@/lib/page-access";
import AdminSettingsClient from "./admin-client";

export default async function AdminSettingsPage() {
  await requirePageAccess("/dashboard/admin");
  return <AdminSettingsClient />;
}
