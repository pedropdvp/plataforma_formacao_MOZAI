import { lookup } from "node:dns/promises";
import { describeRejection, isBlockedAddress, parsePublicUrl } from "./safe-url";

/**
 * Pedido a um endereço escolhido por um utilizador, recusando tudo o que aponte para dentro
 * da rede (as regras estão em lib/safe-url.ts).
 *
 * O nome é resolvido antes do pedido, porque um domínio público pode apontar para 127.0.0.1;
 * e cada salto do redirecionamento volta a ser validado, porque um alvo legítimo pode
 * responder 302 para um endereço interno — com `redirect: "follow"` o pedido seguiria sem
 * perguntar nada.
 */

const MAX_REDIRECTS = 3;

export type PublicFetchResult =
  | { ok: true; response: Response; finalUrl: string }
  | { ok: false; reason: string; status: 400 | 502 };

export async function fetchPublicUrl(rawUrl: string, init: RequestInit = {}): Promise<PublicFetchResult> {
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = parsePublicUrl(current);
    if ("rejection" in parsed) {
      return { ok: false, reason: describeRejection(parsed.rejection), status: 400 };
    }

    const hostname = parsed.url.hostname.replace(/^\[|\]$/g, "");
    try {
      const addresses = await lookup(hostname, { all: true });
      if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
        return { ok: false, reason: describeRejection("endereco-interno"), status: 400 };
      }
    } catch {
      return { ok: false, reason: "Não foi possível resolver este endereço.", status: 502 };
    }

    let response: Response;
    try {
      response = await fetch(parsed.url, { ...init, redirect: "manual" });
    } catch (error: any) {
      return {
        ok: false,
        reason: `Não foi possível contactar este endereço: ${error?.message || "erro de rede"}`,
        status: 502,
      };
    }

    const location =
      response.status >= 300 && response.status < 400 ? response.headers.get("location") : null;
    if (!location) return { ok: true, response, finalUrl: parsed.url.toString() };

    current = new URL(location, parsed.url).toString();
  }

  return { ok: false, reason: "Este endereço tem redirecionamentos a mais.", status: 502 };
}
