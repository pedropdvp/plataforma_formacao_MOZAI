import { requirePageAccess } from "@/lib/page-access";
import AcademicsClient from "./academics-client";

export default async function AcademicsPage() {
  await requirePageAccess("/dashboard/admin/academics");
  return <AcademicsClient />;
}
