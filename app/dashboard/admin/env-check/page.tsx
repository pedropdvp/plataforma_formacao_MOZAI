import { requirePageAccess } from "@/lib/page-access";
import EnvCheckClient from "./env-check-client";

export default async function EnvCheckPage() {
  await requirePageAccess("/dashboard/admin/env-check");
  return <EnvCheckClient />;
}
