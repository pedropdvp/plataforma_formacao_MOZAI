import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { getDb } from "@/lib/mongodb";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

const BLOB_PREFIX = "media/";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — suficiente para imagens/diagramas de curso
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

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
