import { requirePageAccess } from "@/lib/page-access";
import McpsClient from "./mcps-client";

export default async function McpsPage() {
  await requirePageAccess("/dashboard/admin/mcps");
  return <McpsClient />;
}
