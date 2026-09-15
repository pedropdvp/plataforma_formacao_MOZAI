import { requirePageAccess } from "@/lib/page-access";
import ContentFactoryClient from "./content-factory-client";

export default async function ContentFactoryPage() {
  await requirePageAccess("/dashboard/admin/content-factory");
  return <ContentFactoryClient />;
}
