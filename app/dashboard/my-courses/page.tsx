import React from "react";
import { headers } from "next/headers";
import CoursesGrid from "@/components/courses-grid";

export default async function MyCoursesPage() {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id") || "root";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Os Meus Cursos</h1>
        <span className="text-xs text-slate-500">Filtrado por tenant: {tenantId}</span>
      </div>

      <CoursesGrid tenantId={tenantId} />
    </div>
  );
}
