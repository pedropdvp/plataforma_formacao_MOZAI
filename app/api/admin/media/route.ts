import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { put, del } from "@vercel/blob";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

const BLOB_PREFIX = "media/";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — suficiente para imagens/diagramas de curso
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);
const MUX_API_BASE = "https://api.mux.com";

function muxAuthHeader(): string | null {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) return null;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

// GET — Lista a Biblioteca de Media do tenant (imagens já carregadas + vídeos Mux já processados/em processamento)
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "image" | "video" | null (todos)

    const db = await getDb();
    const query: any = { tenantId };
    if (type === "image" || type === "video") query.type = type;

    const items = await db
      .collection("media_library")
      .find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    console.error("Erro ao listar biblioteca de media:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — Regista um novo upload de imagem na Biblioteca de Media (multipart/form-data, campo "file")
// Vídeo não passa por aqui: segue o fluxo dedicado /api/admin/media/mux-upload (upload direto para o Mux).
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const allowedRoles = ["ADMIN", "GESTOR_EMPRESA", "GESTOR_ACADEMICO", "SUPORTE"];
    if (!allowedRoles.includes(activeRole || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const alt = formData.get("alt")?.toString() || "";

    if (!file) {
      return NextResponse.json({ error: "Nenhum ficheiro enviado (campo 'file')." }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Tipo de ficheiro não suportado: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Ficheiro demasiado grande (máx. 8MB)." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const pathname = `${BLOB_PREFIX}${tenantId}/${Date.now()}-${safeName}`;

    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
      // Store dedicado a conteúdo público (imagens/áudio exibidos diretamente aos alunos via
      // <img>/<audio>, que não conseguem autenticar). O BLOB_READ_WRITE_TOKEN "normal" é do
      // store privado partilhado com os backups da BD e rejeita pedidos "public".
      token: process.env.BLOB_READ_WRITE_TOKEN_PUBLIC,
    });

    const db = await getDb();
    const doc = {
      tenantId,
      type: "image" as const,
      url: blob.url,
      filename: file.name,
      alt,
      size: file.size,
      createdAt: new Date(),
      createdBy: userId,
    };
    const result = await db.collection("media_library").insertOne(doc);

    await logAuditEvent(userId, "MEDIA_LIBRARY_IMAGE_UPLOADED", { filename: file.name, tenantId });

    return NextResponse.json({ success: true, item: { ...doc, _id: result.insertedId } });
  } catch (error: any) {
    console.error("Erro ao carregar imagem para a biblioteca de media:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT — Substitui a imagem de um item existente da Biblioteca de Media (mesmo _id, para
// que os blocos de lição que já a referenciam passem a mostrar o novo ficheiro sem precisar
// de arrastar um novo bloco). Vídeo segue um fluxo próprio em mux-upload/route.ts (upload
// assíncrono para o Mux) — este handler é só para imagens.
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const allowedRoles = ["ADMIN", "GESTOR_EMPRESA", "GESTOR_ACADEMICO", "SUPORTE"];
    if (!allowedRoles.includes(activeRole || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const formData = await req.formData();
    const id = formData.get("id")?.toString();
    const file = formData.get("file") as File | null;

    if (!id) {
      return NextResponse.json({ error: "Parâmetro 'id' é obrigatório." }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "Nenhum ficheiro enviado (campo 'file')." }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Tipo de ficheiro não suportado: ${file.type}` }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Ficheiro demasiado grande (máx. 8MB)." }, { status: 400 });
    }

    const db = await getDb();
    const existing = await db.collection("media_library").findOne({ _id: new ObjectId(id), tenantId });
    if (!existing) {
      return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    }
    if (existing.type !== "image") {
      return NextResponse.json({ error: "Este item não é uma imagem — não pode ser substituído por este endpoint." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const pathname = `${BLOB_PREFIX}${tenantId}/${Date.now()}-${safeName}`;

    const blob = await put(pathname, buffer, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN_PUBLIC,
    });

    if (existing.url) {
      try {
        await del(existing.url, { token: process.env.BLOB_READ_WRITE_TOKEN_PUBLIC });
      } catch (err) {
        console.warn("Falha ao apagar o blob antigo ao substituir imagem (a continuar):", err);
      }
    }

    const update = { url: blob.url, filename: file.name, size: file.size, updatedAt: new Date() };
    await db.collection("media_library").updateOne({ _id: existing._id }, { $set: update });

    await logAuditEvent(userId, "MEDIA_LIBRARY_IMAGE_REPLACED", { id, filename: file.name, tenantId });

    return NextResponse.json({ success: true, item: { ...existing, ...update } });
  } catch (error: any) {
    console.error("Erro ao substituir imagem da biblioteca de media:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — Remove um item da Biblioteca de Media: apaga o blob da imagem (ou o asset no
// Mux, para vídeo) e o registo em media_library. Ação individual, por item.
export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação necessária." }, { status: 401 });
    }

    const activeRole = req.cookies.get("active-role")?.value;
    const allowedRoles = ["ADMIN", "GESTOR_EMPRESA", "GESTOR_ACADEMICO", "SUPORTE"];
    if (!allowedRoles.includes(activeRole || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const tenantId = req.headers.get("x-tenant-id") || "root";
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Parâmetro 'id' é obrigatório." }, { status: 400 });
    }

    const db = await getDb();
    const item = await db.collection("media_library").findOne({ _id: new ObjectId(id), tenantId });
    if (!item) {
      return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    }

    if (item.type === "image" && item.url) {
      try {
        await del(item.url, { token: process.env.BLOB_READ_WRITE_TOKEN_PUBLIC });
      } catch (err) {
        console.warn("Falha ao apagar blob da imagem (o registo é apagado na mesma):", err);
      }
    } else if (item.type === "video" && item.muxAssetId) {
      try {
        const authHeader = muxAuthHeader();
        if (authHeader) {
          await fetch(`${MUX_API_BASE}/video/v1/assets/${item.muxAssetId}`, {
            method: "DELETE",
            headers: { Authorization: authHeader },
          });
        }
      } catch (err) {
        console.warn("Falha ao apagar asset no Mux (o registo é apagado na mesma):", err);
      }
    }

    await db.collection("media_library").deleteOne({ _id: new ObjectId(id) });
    await logAuditEvent(userId, "MEDIA_LIBRARY_ITEM_DELETED", { id, type: item.type, tenantId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erro ao apagar item da biblioteca de media:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
