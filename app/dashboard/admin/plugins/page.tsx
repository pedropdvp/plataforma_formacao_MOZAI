import { requirePageAccess } from "@/lib/page-access";
import PluginsClient from "./plugins-client";

export default async function PluginsPage() {
  await requirePageAccess("/dashboard/admin/plugins");
  return <PluginsClient />;
}
