import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("jobId");
    if (!jobId) {
      return NextResponse.json({ error: "O parâmetro jobId é obrigatório." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const job = await db.collection("course_generation_jobs").findOne({
      _id: new ObjectId(jobId),
      tenant_id: tenantId,
    });

    if (!job) {
      return NextResponse.json({ error: "Trabalho de geração não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      status: job.status,
      progress: job.progress,
      currentLessonIndex: job.currentLessonIndex || 0,
      totalLessons: job.totalLessons || 0,
      resultCourseId: job.resultCourseId ? job.resultCourseId.toString() : null,
      error: job.error || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
