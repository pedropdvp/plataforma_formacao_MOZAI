import { getDb } from "@/lib/mongodb";

/**
 * Constantes e chave partilhada de Compliance (RGPD/GDPR) — versão dos Termos &
 * Política de Privacidade atualmente em vigor. Subir este valor força TODOS os
 * utilizadores a aceitar de novo no próximo login (ex: depois de uma alteração legal
 * relevante aos termos).
 */
export const CURRENT_TERMS_VERSION = "2026-07-v1";

/** Nome que substitui o do titular nos registos que são anonimizados em vez de apagados. */
export const ANONYMIZED_NAME = "Utilizador Removido (RGPD)";

/**
 * ÂMBITO DOS DIREITOS DO TITULAR: a pessoa, não a empresa ativa.
 *
 * Um utilizador pode existir em várias empresas ao mesmo tempo (ver o array `tenants` em
 * lib/users.ts), e os direitos de acesso (Art. 15/20) e de apagamento (Art. 17) são do
 * titular sobre TODOS os seus dados — não sobre a fatia da empresa em que por acaso tinha
 * a sessão aberta. Por isso nenhuma consulta deste módulo filtra por `tenant_id`: filtra
 * pelo identificador da pessoa e atravessa as empresas de propósito.
 *
 * Estas operações são exclusivas de perfis da plataforma (ADMIN/SUPORTE) ou do próprio
 * titular sobre si mesmo, pelo que atravessar empresas aqui não abre acesso a dados de
 * terceiros.
 */
export interface PersonalDataSource {
  /** Coleção onde os dados vivem. */
  collection: string;
  /** Campo que identifica o titular nessa coleção. */
  userField: string;
  /** Chave com que a secção aparece no ficheiro de exportação. */
  exportKey: string;
  /** O que fazer no apagamento. */
  onErase: "delete" | "anonymize";
  /** Campo com o nome a substituir, quando a estratégia é anonimizar. */
  nameField?: string;
}

/**
 * Uma única lista serve a exportação e o apagamento. Mantê-las separadas seria garantir
 * que divergiam — e a divergência tem sempre a mesma forma: a plataforma mostra no acesso
 * dados que depois não elimina.
 *
 * Anonimizar em vez de apagar aplica-se onde terceiros têm interesse legítimo no registo:
 * uma publicação numa discussão da comunidade e um projeto já avaliado fazem parte do
 * histórico pedagógico da empresa, e desaparecerem deixaria buracos em avaliações alheias.
 */
export const PERSONAL_DATA_SOURCES: PersonalDataSource[] = [
  { collection: "user_progress", userField: "userId", exportKey: "courseProgress", onErase: "delete" },
  { collection: "quiz_attempts", userField: "userId", exportKey: "quizAttempts", onErase: "delete" },
  { collection: "coding_lab_attempts", userField: "userId", exportKey: "codingLabAttempts", onErase: "delete" },
  { collection: "simulation_lab_attempts", userField: "userId", exportKey: "simulationAttempts", onErase: "delete" },
  { collection: "cognitive_logs", userField: "userId", exportKey: "tutorAiInteractions", onErase: "delete" },
  { collection: "study_history", userField: "userId", exportKey: "studyHistory", onErase: "delete" },
  { collection: "project_submissions", userField: "userId", exportKey: "projectSubmissions", onErase: "anonymize", nameField: "studentName" },
  { collection: "community_posts", userField: "authorId", exportKey: "communityPosts", onErase: "anonymize", nameField: "authorName" },
];

export interface PersonalDataExport {
  exportedAt: string;
  scope: string;
  profile: {
    firstName?: string;
    lastName?: string;
    email?: string;
    tenants?: unknown;
  } | null;
  gamification: unknown;
  [section: string]: unknown;
}

/**
 * Direito de acesso e portabilidade (Art. 15 e 20): todos os dados pessoais do titular,
 * em todas as empresas onde existe. Cada registo é devolvido tal como está guardado —
 * incluindo o seu campo de empresa, para o titular saber a que empresa pertence cada dado.
 */
export async function collectPersonalData(userId: string): Promise<PersonalDataExport> {
  const db = await getDb();

  const [userRecord, gamification, ...sections] = await Promise.all([
    db.collection("users").findOne({ _id: userId }),
    db.collection("gamification_profiles").findOne({ _id: userId }),
    ...PERSONAL_DATA_SOURCES.map((s) =>
      db.collection(s.collection).find({ [s.userField]: userId }).toArray()
    ),
  ]);

  const payload: PersonalDataExport = {
    exportedAt: new Date().toISOString(),
    scope: "Todos os dados do titular, em todas as empresas onde a conta existe.",
    profile: userRecord
      ? {
          firstName: userRecord.firstName,
          lastName: userRecord.lastName,
          email: userRecord.email,
          tenants: userRecord.tenants,
        }
      : null,
    gamification: gamification || null,
  };
  PERSONAL_DATA_SOURCES.forEach((s, i) => {
    payload[s.exportKey] = sections[i];
  });
  return payload;
}

/**
 * Direito ao apagamento (Art. 17), com o mesmo âmbito do acesso: a conta e os dados do
 * titular em todas as empresas. Antes, o apagamento removia o registo de utilizador (que
 * é global) mas só limpava os dados da empresa ativa de quem revia o pedido — a conta
 * desaparecia e ficavam para trás, nas outras empresas, registos a apontar para uma
 * pessoa que já não existia.
 *
 * Devolve o que foi feito, para ficar registado na auditoria.
 */
export async function erasePersonalData(userId: string): Promise<Record<string, number>> {
  const db = await getDb();
  const resultado: Record<string, number> = {};

  for (const source of PERSONAL_DATA_SOURCES) {
    const filtro = { [source.userField]: userId };
    if (source.onErase === "delete") {
      const r = await db.collection(source.collection).deleteMany(filtro);
      resultado[`${source.collection}:apagados`] = r.deletedCount || 0;
    } else {
      const r = await db
        .collection(source.collection)
        .updateMany(filtro, { $set: { [source.nameField as string]: ANONYMIZED_NAME } });
      resultado[`${source.collection}:anonimizados`] = r.modifiedCount || 0;
    }
  }

  const gam = await db.collection("gamification_profiles").deleteOne({ _id: userId as never });
  resultado["gamification_profiles:apagados"] = gam.deletedCount || 0;

  // O registo de utilizador vai por último: enquanto existir, um apagamento interrompido a
  // meio ainda é retomável a partir dele.
  const user = await db.collection("users").deleteOne({ _id: userId as never });
  resultado["users:apagados"] = user.deletedCount || 0;

  return resultado;
}
