/**
 * Validação dos endereços que a plataforma visita a pedido de quem a usa.
 *
 * Duas ferramentas aceitam um URL escrito por um utilizador — o verificador de cabeçalhos do
 * Cyber Lab e a importação de páginas da Fábrica de Cursos — e é o servidor que faz o pedido.
 * Sem filtro, a plataforma torna-se um intermediário para alcançar o que só ela vê: a rede
 * interna, o loopback e os endereços de metadados das nuvens (SSRF).
 *
 * Aceita-se http e https, nas portas normais, sem credenciais no endereço e nunca para gamas
 * reservadas. Módulo puro — quem resolve o nome e segue os redirecionamentos é lib/safe-fetch.ts.
 */

const ALLOWED_PROTOCOLS = ["http:", "https:"];
const ALLOWED_PORTS = ["", "80", "443"];

/** Nomes que apontam sempre para a própria máquina ou para serviços internos. */
const BLOCKED_HOSTNAMES = [/^localhost$/i, /\.local$/i, /\.internal$/i, /^metadata\.google\.internal$/i];

export type UrlRejection = "protocolo" | "porta" | "credenciais" | "endereco-interno" | "invalido";

export function describeRejection(rejection: UrlRejection): string {
  switch (rejection) {
    case "protocolo":
      return "Só são aceites endereços http:// ou https://.";
    case "porta":
      return "Só são aceites as portas normais da web (80 e 443).";
    case "credenciais":
      return "Não são aceites endereços com utilizador e palavra-passe.";
    case "endereco-interno":
      return "Este endereço aponta para a rede interna e não pode ser consultado.";
    default:
      return "Endereço inválido.";
  }
}

/** O endereço IP pertence a uma gama reservada, privada ou de loopback? */
export function isBlockedAddress(address: string): boolean {
  const ipv4 = address.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number);
    if (parts.some((part) => part > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true; // este host, privada, loopback
    if (a === 169 && b === 254) return true; // link-local: metadados das nuvens
    if (a === 172 && b >= 16 && b <= 31) return true; // privada
    if (a === 192 && b === 168) return true; // privada
    if (a === 192 && b === 0) return true; // protocolos e documentação
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true; // testes de desempenho
    if (a >= 224) return true; // multicast e reservados
    return false;
  }

  if (!address.includes(":")) return false; // não é um IP literal, é um nome

  const ipv6 = address.toLowerCase();
  const mapped = ipv6.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isBlockedAddress(mapped[1]);
  if (ipv6 === "::" || ipv6 === "::1") return true;
  if (/^f[cd]/.test(ipv6)) return true; // unique local
  if (ipv6.startsWith("fe80")) return true; // link-local
  return false;
}

export type ParsedUrl = { url: URL } | { rejection: UrlRejection };

export function parsePublicUrl(raw: string): ParsedUrl {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { rejection: "invalido" };
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) return { rejection: "protocolo" };
  if (!ALLOWED_PORTS.includes(url.port)) return { rejection: "porta" };
  if (url.username || url.password) return { rejection: "credenciais" };
  if (BLOCKED_HOSTNAMES.some((blocked) => blocked.test(url.hostname))) return { rejection: "endereco-interno" };
  if (isBlockedAddress(url.hostname.replace(/^\[|\]$/g, ""))) return { rejection: "endereco-interno" };

  return { url };
}
