import { requirePageAccess } from "@/lib/page-access";
import JobPostingsClient from "./job-postings-client";

export default async function JobPostingsPage() {
  await requirePageAccess("/dashboard/admin/job-postings");
  return <JobPostingsClient />;
}
