import { requirePageAccess } from "@/lib/page-access";
import BackupRestoreClient from "./backups-client";

export default async function BackupRestorePage() {
  await requirePageAccess("/dashboard/admin/backups");
  return <BackupRestoreClient />;
}
