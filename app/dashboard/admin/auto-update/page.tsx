import { requirePageAccess } from "@/lib/page-access";
import AutoUpdateClient from "./auto-update-client";

export default async function AutoUpdatePage() {
  await requirePageAccess("/dashboard/admin/auto-update");
  return <AutoUpdateClient />;
}
