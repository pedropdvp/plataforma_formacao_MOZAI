import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

// GET — Lista os avatares de treino do tenant (visíveis a todos, geridos só pelo autor/ADMIN).
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const avatars = await db.collection("training_avatars").find({ tenant_id: tenantId }).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      avatars: avatars.map((a: any) => ({
        id: a._id.toString(),
        name: a.name,
        role: a.role,
        subject: a.subject,
        scenario: a.scenario,
        difficulty: a.difficulty,
        createdById: a.createdById,
        createdByName: a.createdByName,
      })),
    });
  } catch (error: any) {
    console.error("Erro ao listar avatares de treino:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Cria um novo avatar de treino real. O system prompt (usado depois para a conversa
// real com IA) é construído a partir destes campos — nunca escondido, sempre rastreável ao que
// o criador escreveu.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { name, role, subject, scenario, difficulty } = await req.json();
    if (!name?.trim() || !role?.trim() || !subject?.trim() || !scenario?.trim()) {
      return NextResponse.json({ error: "Nome, papel, tema e cenário são obrigatórios." }, { status: 400 });
    }
    if (!["Fácil", "Médio", "Difícil"].includes(difficulty)) {
      return NextResponse.json({ error: "Dificuldade inválida." }, { status: 400 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const db = await getDb();
    const userRecord = await db.collection("users").findOne({ _id: userId });
    const createdByName = userRecord ? `${userRecord.firstName || ""} ${userRecord.lastName || ""}`.trim() || userRecord.email : "Utilizador";

    const result = await db.collection("training_avatars").insertOne({
      tenant_id: tenantId,
      createdById: userId,
      createdByName,
      name: name.trim(),
      role: role.trim(),
      subject: subject.trim(),
      scenario: scenario.trim(),
      difficulty,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await logAuditEvent(userId, "TRAINING_AVATAR_CREATED", { tenantId, avatarId: result.insertedId?.toString(), name: name.trim() });

    return NextResponse.json({ success: true, avatarId: result.insertedId?.toString() });
  } catch (error: any) {
    console.error("Erro ao criar avatar de treino:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
