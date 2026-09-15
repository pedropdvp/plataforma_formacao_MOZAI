import { requirePageAccess } from "@/lib/page-access";
import ChatbotClient from "./chatbot-client";

export default async function ChatbotPage() {
  await requirePageAccess("/dashboard/admin/chatbot");
  return <ChatbotClient />;
}
