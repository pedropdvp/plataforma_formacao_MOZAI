import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { logAuditEvent } from "@/lib/audit";
import { collectPersonalData } from "@/lib/compliance";

// GET — Direito de acesso e portabilidade (RGPD Art. 15/20): devolve TODOS os dados
// pessoais reais do utilizador autenticado, num único JSON descarregável. Cada secção
// vem diretamente das coleções reais — nada é resumido ou fabricado.
//
// O âmbito é o titular, não a empresa ativa: quem existe em várias empresas leva num só
// ficheiro os dados de todas elas (ver lib/compliance.ts). Antes exportava apenas a fatia
// da empresa em que tinha a sessão aberta, o que não é o direito que o artigo consagra.
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const exportPayload = await collectPersonalData(userId);

    await logAuditEvent(userId, "PERSONAL_DATA_EXPORTED", {
      tenantId: req.headers.get("x-tenant-id") || "root",
      scope: "all-tenants",
    });

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="mozai-dados-pessoais-${userId}.json"`,
      },
    });
  } catch (error: any) {
    console.error("Erro ao exportar dados pessoais:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
