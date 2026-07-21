import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { logAuditEvent } from "@/lib/audit";

/**
 * GET: Obtém a lista de tickets.
 * - Se for ADMIN ou SUPORTE, retorna TODOS os tickets do sistema (ordenados por status Pendente e data).
 * - Se for outro perfil, retorna apenas os tickets que o próprio utilizador criou.
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const isAdminOrSupport = activeRole === "ADMIN" || activeRole === "SUPORTE";

    const db = await getDb();
    let tickets;

    if (isAdminOrSupport) {
      // Admins/Suporte veem tudo. Ordenamos "Pendente" primeiro, depois pela data de criação
      tickets = await db.collection("support_tickets")
        .find({})
        .sort({ status: 1, createdAt: -1 })
        .toArray();
    } else {
      // Alunos/utilizadores comuns veem apenas os seus próprios tickets
      tickets = await db.collection("support_tickets")
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();
    }

    return NextResponse.json(tickets);
  } catch (error: any) {
    console.error("Erro ao obter tickets de suporte:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST: Cria um novo pedido de suporte na base de dados (Aluno)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || "email@mozai.education";
    const userName = `${user?.firstName || "Utilizador"} ${user?.lastName || "MOZAI"}`.trim();

    const body = await req.json();
    const { subject, message } = body;

    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Preencha todos os campos obrigatórios." }, { status: 400 });
    }

    const db = await getDb();
    const newTicket = {
      userId,
      userEmail,
      userName,
      subject: subject.trim(),
      message: message.trim(),
      status: "Pendente", // Status possíveis: "Pendente" | "Respondido" | "Resolvido"
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection("support_tickets").insertOne(newTicket);

    // Registar auditoria
    await logAuditEvent(userId, "SUPPORT_TICKET_CREATED", {
      ticketId: result.insertedId.toString(),
      subject: subject.trim()
    });

    return NextResponse.json({
      success: true,
      ticket: {
        ...newTicket,
        _id: result.insertedId.toString()
      }
    });
  } catch (error: any) {
    console.error("Erro ao criar ticket de suporte:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT: Responde a um ticket de suporte (Exclusivo para ADMIN ou SUPORTE)
 */
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // Validar se o utilizador atual é Admin ou Suporte
    const activeRole = req.cookies.get("active-role")?.value;
    if (activeRole !== "ADMIN" && activeRole !== "SUPORTE") {
      return NextResponse.json({ error: "Apenas a equipa de Suporte/Administradores pode responder a pedidos." }, { status: 403 });
    }

    const user = await currentUser();
    const replierName = `${user?.firstName || "Suporte"} ${user?.lastName || "Técnico"}`.trim();

    const body = await req.json();
    const { ticketId, replyMessage } = body;

    if (!ticketId || !replyMessage?.trim()) {
      return NextResponse.json({ error: "Faltam parâmetros obrigatórios." }, { status: 400 });
    }

    const db = await getDb();
    const ticketObjectId = new ObjectId(ticketId);

    const ticket = await db.collection("support_tickets").findOne({ _id: ticketObjectId });
    if (!ticket) {
      return NextResponse.json({ error: "Pedido de suporte não encontrado." }, { status: 444 });
    }

    // Atualizar ticket com a resposta e marcar como "Respondido"
    await db.collection("support_tickets").updateOne(
      { _id: ticketObjectId },
      {
        $set: {
          status: "Respondido",
          replyMessage: replyMessage.trim(),
          repliedAt: new Date(),
          replierName,
          updatedAt: new Date()
        }
      }
    );

    const updatedTicket = await db.collection("support_tickets").findOne({ _id: ticketObjectId });

    // Registar auditoria
    await logAuditEvent(userId, "SUPPORT_TICKET_REPLIED", {
      ticketId,
      replierName,
      subject: ticket.subject
    });

    return NextResponse.json({
      success: true,
      ticket: updatedTicket
    });
  } catch (error: any) {
    console.error("Erro ao responder a ticket de suporte:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
