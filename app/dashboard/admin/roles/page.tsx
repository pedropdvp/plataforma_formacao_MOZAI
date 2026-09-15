import { requirePageAccess } from "@/lib/page-access";
import AccessProfilesClient from "./roles-client";

export default async function AccessProfilesPage() {
  await requirePageAccess("/dashboard/admin/roles");
  return <AccessProfilesClient />;
}
