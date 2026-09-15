import { requirePageAccess } from "@/lib/page-access";
import MenuVisibilityClient from "./menus-client";

export default async function MenuVisibilityPage() {
  await requirePageAccess("/dashboard/admin/menus");
  return <MenuVisibilityClient />;
}
