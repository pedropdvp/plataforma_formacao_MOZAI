import { requirePageAccess } from "@/lib/page-access";
import MyStudentsReportClient from "./my-students-client";

export default async function MyStudentsReportPage() {
  await requirePageAccess("/dashboard/reports/my-students");
  return <MyStudentsReportClient />;
}
