import { requirePageAccess } from "@/lib/page-access";
import ContentFactoryToolsClient from "./content-factory-tools-client";

export default async function ContentFactoryToolsPage() {
  await requirePageAccess("/dashboard/admin/content-factory-tools");
  return <ContentFactoryToolsClient />;
}
