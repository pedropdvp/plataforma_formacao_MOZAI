import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "@/lib/audit";

const SECURITY_HEADERS = [
  { key: "strict-transport-security", label: "Strict-Transport-Security (HSTS)" },
  { key: "content-security-policy", label: "Content-Security-Policy" },
  { key: "x-content-type-options", label: "X-Content-Type-Options" },
  { key: "x-frame-options", label: "X-Frame-Options" },
  { key: "referrer-policy", label: "Referrer-Policy" },
  { key: "permissions-policy", label: "Permissions-Policy" },
];

// POST — Verificação REAL dos cabeçalhos de segurança HTTP de um URL público: faz um pedido
// genuíno ao alvo e lê os cabeçalhos reais da resposta — nunca simula. Ferramenta passiva e
// segura (não envia payloads nem tenta explorar nada), equivalente a "curl -I".
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { url } = await req.json();
    if (!url?.trim() || !/^https?:\/\/\S+$/i.test(url.trim())) {
      return NextResponse.json({ error: "Introduza um URL válido (http:// ou https://)." }, { status: 400 });
    }

    let res: Response;
    try {
      res = await fetch(url.trim(), { method: "GET", redirect: "follow", signal: AbortSignal.timeout(10000) });
    } catch (err: any) {
      return NextResponse.json({ error: `Não foi possível contactar este URL: ${err.message}` }, { status: 502 });
    }

    const results = SECURITY_HEADERS.map((h) => ({
      key: h.key,
      label: h.label,
      present: res.headers.has(h.key),
      value: res.headers.get(h.key),
    }));

    await logAuditEvent(userId, "CYBER_LAB_HEADERS_CHECK", { url: url.trim(), status: res.status });

    return NextResponse.json({ success: true, httpStatus: res.status, results });
  } catch (error: any) {
    console.error("Erro ao verificar cabeçalhos HTTP:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
