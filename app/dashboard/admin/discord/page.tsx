import { requirePageAccess } from "@/lib/page-access";
import DiscordAdminClient from "./discord-client";

export default async function DiscordAdminPage() {
  await requirePageAccess("/dashboard/admin/discord");
  return <DiscordAdminClient />;
}
