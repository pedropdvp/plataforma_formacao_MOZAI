import { NextRequest, NextResponse } from "next/server";
import { sanityClient } from "@/lib/sanity";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { headers } from "next/headers";

/**
 * Devolve os cursos publicados no Sanity filtrados de acordo com a atribuição B2B,
 * caso o aluno pertença a um inquilino corporativo.
 */
export const runtime = "nodejs";

const CATALOG_QUERY = `
  *[_type == "course"] | order(title asc) {
    _id,
    title,
    description,
    "category": coalesce(category->title, "Formação"),
    "lessonsCount": count(modules[]->lessons[]),
    "minutes": math::sum(modules[]->lessons[]->duration),
    "firstLesson": (modules[]->lessons[]->slug.current)[0]
  }
`;

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    const headersList = await headers();
    const tenantId = headersList.get("x-tenant-id") || "root";

    let courses = await sanityClient.fetch(CATALOG_QUERY);
    courses = Array.isArray(courses) ? courses : [];

    // Se o formando estiver autenticado e pertencer a uma empresa (tenantId !== 'root')
    // aplicamos a regra de visibilidade restrita a cursos atribuídos (Condomanager style)
    if (userId && tenantId !== "root") {
      const db = await getDb();
      const assigned = await db.collection("assigned_courses").find({ tenantId, userId }).toArray();
      const assignedCourseIds = assigned.map((a: any) => a.courseId);

      courses = courses.filter((c: any) => assignedCourseIds.includes(c._id));
    }

    // --- INTEGRAR CURSOS GERADOS POR IA DE MONGODB ---
    try {
      const db = await getDb();
      const queryConds: any = { tenant_id: tenantId };

      if (userId) {
        const activeRole = req.cookies.get("active-role")?.value || "ALUNO";
        if (activeRole === "ALUNO") {
          queryConds.$or = [
            { status: "PUBLISHED", isPrivate: false },
            { generatedByUserId: userId }
          ];
        } else {
          // ADMIN, GESTOR_ACADEMICO, FORMADOR veem rascunhos para revisão e curadoria
          queryConds.status = { $in: ["PUBLISHED", "DRAFT_PENDING_REVIEW"] };
        }
      } else {
        queryConds.status = "PUBLISHED";
      }

      const aiCourses = await db.collection("courses").find(queryConds).toArray();
      const formattedAiCourses = aiCourses.map((c: any) => ({
        _id: c._id.toString(),
        title: c.title,
        description: c.description,
        category: "IA Custom",
        lessonsCount: (c.modules || []).reduce((acc: number, m: any) => acc + (m.lessons || []).length, 0),
        minutes: (c.modules || []).reduce((acc: number, m: any) => {
          return acc + (m.lessons || []).reduce((lAcc: number, l: any) => {
            const dur = parseInt(l.duration) || 15;
            return lAcc + dur;
          }, 0);
        }, 0),
        firstLesson: c.modules?.[0]?.lessons?.[0]?.slug || c.modules?.[0]?.lessons?.[0]?.id || ""
      }));

      courses = [...courses, ...formattedAiCourses];
    } catch (dbErr) {
      console.warn("RAG: falha ao acoplar catálogo do MongoDB:", dbErr);
    }

    return NextResponse.json({ courses });
  } catch (error: any) {
    console.warn("Falha ao carregar catálogo do Sanity:", error?.message);
    return NextResponse.json({ courses: [] });
  }
}
