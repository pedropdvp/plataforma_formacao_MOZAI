import { findOneTenantScoped, getDb } from "@/lib/mongodb";
import { NON_HIDEABLE_MENU_IDS } from "@/lib/menu-registry";

/** Ids de menus ocultos configurados pelo Admin para este tenant (vazio = tudo visível). */
export async function getHiddenMenuIdsForTenant(tenantId: string): Promise<string[]> {
  const settings = await findOneTenantScoped("tenant_settings", tenantId);
  const ids = Array.isArray(settings?.hiddenMenuIds) ? settings.hiddenMenuIds : [];
  return ids.filter((id: string) => !NON_HIDEABLE_MENU_IDS.has(id));
}

export async function setHiddenMenuIdsForTenant(tenantId: string, hiddenMenuIds: string[]): Promise<void> {
  const filtered = hiddenMenuIds.filter((id) => !NON_HIDEABLE_MENU_IDS.has(id));
  const db = await getDb();
  await db.collection("tenant_settings").updateOne(
    { tenant_id: tenantId },
    { $set: { tenant_id: tenantId, hiddenMenuIds: filtered, hiddenMenuIdsUpdatedAt: new Date() } },
    { upsert: true }
  );
}
