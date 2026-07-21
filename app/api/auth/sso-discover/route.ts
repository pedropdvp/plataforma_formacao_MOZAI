import { NextRequest, NextResponse } from "next/server";
import { discoverTenantByEmailDomain } from "@/lib/workos";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Por favor, introduza um endereço de e-mail corporativo válido." },
        { status: 400 }
      );
    }

    const domain = email.split("@")[1].toLowerCase();

    // 1. Tentar descobrir via API da WorkOS
    const workosConnection = await discoverTenantByEmailDomain(email);

    if (workosConnection) {
      return NextResponse.json({
        success: true,
        provider: "WorkOS SAML SSO (Real)",
        organizationName: workosConnection.name,
        tenantId: workosConnection.organizationId,
      });
    }

    // 2. Fallback de Simulação Corporativa para demonstração offline
    const simulatedDomains: Record<string, { orgName: string; tenantId: string }> = {
      "acme.com": { orgName: "ACME Corporation B2B", tenantId: "acme" },
      "empresa.com": { orgName: "Empresa Portuguesa SaaS", tenantId: "empresa" },
      "mozai.com": { orgName: "MOZAI International", tenantId: "root" },
      "universidade.edu": { orgName: "Universidade de Tecnologia", tenantId: "universidade" },
    };

    if (simulatedDomains[domain]) {
      const sim = simulatedDomains[domain];
      return NextResponse.json({
        success: true,
        provider: "WorkOS Enterprise SAML (Simulado)",
        organizationName: sim.orgName,
        tenantId: sim.tenantId,
      });
    }

    return NextResponse.json({
      success: false,
      message: "Nenhuma conexão SSO corporativa ativa foi encontrada para este domínio de e-mail.",
    });
  } catch (error: any) {
    console.error("Erro no SSO Tenant Discovery:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
