import { getDb } from "./mongodb";

/**
 * Regista um evento de segurança ou ação crítica na coleção 'audit_logs' do MongoDB.
 * Assinatura mantida compatível com chamadas existentes no projeto.
 */
export async function logAuditEvent(
  userId: string,
  action: string,
  metadata: any = {}
) {
  try {
    const db = await getDb();
    
    // Procurar detalhes do utilizador executor na base de dados
    const user = await db.collection("users").findOne({ _id: userId });
    const userName = user ? `${user.firstName} ${user.lastName}`.trim() : "Utilizador Desconhecido";
    const userEmail = user ? user.email : "desconhecido@mozai.education";
    
    // Determinar o inquilino (tenantId) associado à ação
    const tenantId = metadata.tenantId || (user?.tenants?.[0]?.tenantId) || "root";
    
    // Gerar uma descrição amigável com base na ação e metadados
    let description = metadata.description || `${action} executado por ${userName}`;
    if (action === "COMPANY_CREATED") {
      description = `Empresa "${metadata.companyName}" criada com gestor ${metadata.gestorEmail}`;
    } else if (action === "COMPANY_UPDATED") {
      description = `Empresa "${metadata.companyName}" atualizada`;
    } else if (action === "COMPANY_DELETED") {
      description = `Empresa ID "${metadata.companyId}" eliminada permanentemente`;
    } else if (action === "COMPANY_USER_CREATED") {
      description = `Colaborador ${metadata.createdUserEmail} registado com papel ${metadata.createdUserRole}`;
    } else if (action === "COMPANY_USER_UPDATED") {
      description = `Colaborador ${metadata.updatedUserEmail} atualizado para papel ${metadata.updatedUserRole}`;
    } else if (action === "COMPANY_USER_DELETED") {
      description = `Associação do colaborador ID ${metadata.deletedUserId} removida`;
    }

    const logEntry = {
      userId,
      userName,
      userEmail,
      tenantId,
      action,
      description,
      metadata,
      timestamp: new Date()
    };

    await db.collection("audit_logs").insertOne(logEntry);
    console.log(`[AUDIT] ${action} efetuado por ${userEmail} em tenant "${tenantId}": ${description}`);
  } catch (error) {
    console.error("Erro ao inserir log de auditoria no MongoDB:", error);
  }
}

/**
 * Igual a {@link logAuditEvent}, mas **propaga o erro** em vez de o engolir.
 *
 * Existe para as acções em que o registo é a condição da acção, e não um extra: revelar
 * o valor de um segredo, por exemplo. Um segredo mostrado sem deixar rasto é pior do que
 * um segredo não mostrado — quem quiser auditar um incidente depois não terá por onde
 * começar. Nesses casos, falhar a gravar tem de impedir a operação.
 */
export async function logAuditEventStrict(
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const db = await getDb();
  const user = await db.collection("users").findOne({ _id: userId });
  const userName = user ? `${user.firstName} ${user.lastName}`.trim() : "Utilizador Desconhecido";
  const userEmail = user ? user.email : "desconhecido@mozai.education";
  const tenantId = (metadata.tenantId as string) || user?.tenants?.[0]?.tenantId || "root";

  const resultado = await db.collection("audit_logs").insertOne({
    userId,
    userName,
    userEmail,
    tenantId,
    action,
    description: (metadata.description as string) || `${action} executado por ${userName}`,
    metadata,
    timestamp: new Date(),
  });
  if (!resultado.acknowledged) {
    throw new Error("O registo de auditoria não foi confirmado pela base de dados.");
  }
}
