import React from "react";
import CoursesGrid from "@/components/courses-grid";
import { getTenantId } from "@/lib/session";

export default async function MyCoursesPage() {
  const tenantId = await getTenantId();

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
