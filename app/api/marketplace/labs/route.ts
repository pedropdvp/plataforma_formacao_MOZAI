import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Catálogo de Laboratórios de código: exercícios públicos de qualquer organização
// (cross-tenant, tal como Mentores/Datasets) + os próprios.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const db = await getDb();

    const filter: any = {
      $or: [{ isPublic: true }, { ownerId: userId, tenant_id: tenantId }],
    };
    if (q) {
      filter.$and = [
        { $or: filter.$or },
        { $or: [{ title: { $regex: q, $options: "i" } }, { language: { $regex: q, $options: "i" } }] },
      ];
      delete filter.$or;
    }

    const labs = await db
      .collection("marketplace_labs")
      .find(filter)
      .sort({ usesCount: -1, createdAt: -1 })
      .toArray();

    const formatted = labs.map((l: any) => ({
      id: l._id.toString(),
      title: l.title,
      description: l.description,
      language: l.language,
      difficulty: l.difficulty,
      starterCode: l.starterCode,
      stdin: l.stdin || "",
      expectedOutput: l.expectedOutput || "",
      isPublic: l.isPublic,
      usesCount: l.usesCount || 0,
      ownerName: l.ownerName,
      isMine: l.ownerId === userId,
      createdAt: l.createdAt,
    }));

    return NextResponse.json({ success: true, labs: formatted });
  } catch (error: any) {
    console.error("Erro ao listar Laboratórios:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Publica um novo Laboratório: um exercício de código com enunciado, código inicial e,
// opcionalmente, um resultado esperado — executável no motor real do Coding Lab (Piston).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { title, description, language, difficulty, starterCode, stdin, expectedOutput, isPublic } = await req.json();
    if (!title?.trim() || !description?.trim() || !language?.trim()) {
      return NextResponse.json({ error: "Título, enunciado e linguagem são obrigatórios." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();

    const userRecord = await db.collection("users").findOne({ _id: userId });
    const ownerName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const result = await db.collection("marketplace_labs").insertOne({
      tenant_id: tenantId,
      ownerId: userId,
      ownerName,
      title: title.trim(),
      description: description.trim(),
      language: language.trim().toLowerCase(),
      difficulty: difficulty?.trim() || "Iniciante",
      starterCode: starterCode || "",
      stdin: stdin?.trim() || "",
      expectedOutput: expectedOutput?.trim() || "",
      isPublic: !!isPublic,
      usesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await logAuditEvent(userId, "MARKETPLACE_LAB_PUBLISHED", { tenantId, labId: result.insertedId?.toString(), title: title.trim() });

    return NextResponse.json({ success: true, labId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao publicar Laboratório:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
