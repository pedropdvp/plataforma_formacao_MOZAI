import { requirePageAccess } from "@/lib/page-access";
import AdminProjectsClient from "./projects-client";

export default async function AdminProjectsPage() {
  await requirePageAccess("/dashboard/admin/projects");
  return <AdminProjectsClient />;
}
