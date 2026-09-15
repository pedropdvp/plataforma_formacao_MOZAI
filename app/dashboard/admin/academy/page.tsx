import { requirePageAccess } from "@/lib/page-access";
import AcademyClient from "./academy-client";

export default async function AcademyPage() {
  await requirePageAccess("/dashboard/admin/academy");
  return <AcademyClient />;
}
