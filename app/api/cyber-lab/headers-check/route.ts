import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "@/lib/audit";
import { fetchPublicUrl } from "@/lib/safe-fetch";

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
    const target = (url || "").trim();

    // O alvo é escrito por quem usa a ferramenta: sem validação, a plataforma faria pedidos à
    // rede interna por conta de terceiros (SSRF). Ver lib/safe-fetch.ts.
    const attempt = await fetchPublicUrl(target, { method: "GET", signal: AbortSignal.timeout(10000) });
    if (!attempt.ok) {
      return NextResponse.json({ error: attempt.reason }, { status: attempt.status });
    }
    const res = attempt.response;

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
