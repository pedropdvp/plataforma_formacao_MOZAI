import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";
import { ObjectId } from "mongodb";

// GET — Devolve os detalhes completos de um avatar (para a ficha de "Visualizar").
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const { id } = await params;
    const db = await getDb();
    const avatar = await db.collection("training_avatars").findOne({ _id: new ObjectId(id) });
    if (!avatar) {
      return NextResponse.json({ error: "Avatar não encontrado." }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      avatar: {
        id: avatar._id.toString(),
        name: avatar.name,
        role: avatar.role,
        subject: avatar.subject,
        scenario: avatar.scenario,
        difficulty: avatar.difficulty,
        createdById: avatar.createdById,
        createdByName: avatar.createdByName,
        createdAt: avatar.createdAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH — Edita um avatar existente (só o autor ou ADMIN/SUPORTE).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const { id } = await params;
    const { name, role, subject, scenario, difficulty } = await req.json();
    if (!name?.trim() || !role?.trim() || !subject?.trim() || !scenario?.trim()) {
      return NextResponse.json({ error: "Nome, papel, tema e cenário são obrigatórios." }, { status: 400 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const db = await getDb();
    const avatar = await db.collection("training_avatars").findOne({ _id: new ObjectId(id) });
    if (!avatar) {
      return NextResponse.json({ error: "Avatar não encontrado." }, { status: 404 });
    }
    const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";
    if (avatar.createdById !== userId && !isModerator) {
      return NextResponse.json({ error: "Sem permissão para editar este avatar." }, { status: 403 });
    }

    await db.collection("training_avatars").updateOne(
      { _id: new ObjectId(id) },
      { $set: { name: name.trim(), role: role.trim(), subject: subject.trim(), scenario: scenario.trim(), difficulty, updatedAt: new Date() } }
    );

    await logAuditEvent(userId, "TRAINING_AVATAR_UPDATED", { avatarId: id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Apaga um avatar (só o autor ou ADMIN/SUPORTE).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }
    const { id } = await params;
    const activeRole = req.cookies.get("active-role")?.value;
    const db = await getDb();
    const avatar = await db.collection("training_avatars").findOne({ _id: new ObjectId(id) });
    if (!avatar) {
      return NextResponse.json({ error: "Avatar não encontrado." }, { status: 404 });
    }
    const isModerator = activeRole === "ADMIN" || activeRole === "SUPORTE";
    if (avatar.createdById !== userId && !isModerator) {
      return NextResponse.json({ error: "Sem permissão para apagar este avatar." }, { status: 403 });
    }

    await db.collection("training_avatars").deleteOne({ _id: new ObjectId(id) });

    await logAuditEvent(userId, "TRAINING_AVATAR_DELETED", { avatarId: id, name: avatar.name });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
