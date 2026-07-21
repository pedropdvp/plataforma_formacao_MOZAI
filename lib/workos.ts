import { WorkOS } from "@workos-inc/node";

if (!process.env.WORKOS_API_KEY) {
  // Apenas alerta em tempo de desenvolvimento para evitar falhas silenciosas
  console.warn("Aviso: A variável de ambiente WORKOS_API_KEY não está definida.");
}

// Inicializar o cliente da WorkOS com a API Key secreta
export const workos = new WorkOS(process.env.WORKOS_API_KEY || "dummy_api_key");

/**
 * Função utilitária para descobrir ou validar uma organização baseada no domínio do e-mail.
 * Isto resolve o requisito de "Tenant Discovery" (Identidade Global e Tenant Discovery).
 */
export async function discoverTenantByEmailDomain(email: string) {
  try {
    const domain = email.split("@")[1];
    if (!domain) return null;

    // Buscar conexões de SSO ativas para este domínio na WorkOS
    const connections = await workos.sso.listConnections({
      domain,
    });

    if (connections.data.length > 0) {
      const activeConnection = connections.data[0];
      return {
        organizationId: activeConnection.organizationId,
        connectionId: activeConnection.id,
        name: activeConnection.name,
      };
    }
    
    return null;
  } catch (error) {
    console.error("Erro ao tentar descobrir tenant pelo domínio do e-mail na WorkOS:", error);
    return null;
  }
}
