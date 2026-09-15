import { requirePageAccess } from "@/lib/page-access";
import LevelsClient from "./levels-client";

export default async function LevelsPage() {
  await requirePageAccess("/dashboard/admin/levels");
  return <LevelsClient />;
}
