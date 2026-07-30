import { getDb } from "@/lib/mongodb";

/**
 * Sistema de Plugins do AI Marketplace — decisão deliberada de âmbito: NÃO é uma sandbox
 * de execução de código de terceiros (arriscado, exigiria isolamento de processo/rede que
 * foge do stack atual e da regra de nunca introduzir tecnologia não autorizada). Em vez
 * disso, é um sistema real e seguro de INTEGRAÇÕES POR WEBHOOK: a empresa "instala" um
 * plugin indicando um URL (ex: um Slack Incoming Webhook, um Zapier "Catch Hook", ou um
 * endpoint próprio), escolhe a que eventos reais quer reagir, e a plataforma faz um POST
 * HTTP real a esse URL sempre que o evento acontece de verdade — nunca simulado.
 */

export interface PluginEventDef {
  id: string;
  label: string;
  description: string;
}

export interface PluginCatalogEntry {
  id: string;
  name: string;
  description: string;
  events: PluginEventDef[];
}

export const PLUGIN_EVENTS: PluginEventDef[] = [
  { id: "job.application_submitted", label: "Nova Candidatura a Vaga", description: "Disparado quando um aluno se candidata a uma vaga da empresa no Marketplace." },
  { id: "project.approved", label: "Projeto Aprovado", description: "Disparado quando um projeto submetido por um aluno é aprovado." },
  { id: "mentorship.requested", label: "Pedido de Mentoria Recebido", description: "Disparado quando um mentor recebe um novo pedido de mentoria." },
];

export const PLUGIN_CATALOG: PluginCatalogEntry[] = [
  {
    id: "generic-webhook",
    name: "Webhook Genérico",
    description: "Envia um POST HTTP com JSON para qualquer URL sua, para cada evento escolhido.",
    events: PLUGIN_EVENTS,
  },
  {
    id: "slack",
    name: "Slack",
    description: "Notifica um canal do Slack via Incoming Webhook sempre que o evento escolhido acontecer.",
    events: PLUGIN_EVENTS,
  },
  {
    id: "zapier",
    name: "Zapier / Make",
    description: "Envia os dados do evento para um 'Catch Hook' do Zapier ou Make, para automatizar o que quiser a seguir.",
    events: PLUGIN_EVENTS,
  },
];

/**
 * Dispara um evento real para todos os plugins ativos do tenant subscritos a esse
 * evento. Nunca lança erro para quem chamou — uma falha de rede num webhook de terceiros
 * nunca pode rebentar a ação real da plataforma que originou o evento (ex: aprovar um
 * projeto tem de funcionar mesmo que o Slack da empresa esteja em baixo).
 */
export async function triggerPluginEvent(tenantId: string, eventId: string, payload: Record<string, any>): Promise<void> {
  try {
    const db = await getDb();
    const installedPlugins = await db.collection("installed_plugins").find({ tenant_id: tenantId, isActive: true, events: eventId }).toArray();

    await Promise.all(
      installedPlugins.map(async (plugin: any) => {
        try {
          await fetch(plugin.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: eventId, tenantId, timestamp: new Date().toISOString(), data: payload }),
            signal: AbortSignal.timeout(8000),
          });
          await db.collection("installed_plugins").updateOne({ _id: plugin._id }, { $set: { lastTriggeredAt: new Date(), lastError: null } });
        } catch (err: any) {
          console.warn(`Falha ao disparar plugin "${plugin.pluginId}" para o evento "${eventId}":`, err?.message);
          await db.collection("installed_plugins").updateOne({ _id: plugin._id }, { $set: { lastError: err?.message || "Erro desconhecido", lastErrorAt: new Date() } });
        }
      })
    );
  } catch (err) {
    console.warn(`Falha ao processar plugins para o evento "${eventId}":`, err);
  }
}
