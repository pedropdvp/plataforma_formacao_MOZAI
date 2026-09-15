import { requirePageAccess } from "@/lib/page-access";
import ApiKeysClient from "./api-keys-client";

export default async function ApiKeysPage() {
  await requirePageAccess("/dashboard/admin/api-keys");
  return <ApiKeysClient />;
}
