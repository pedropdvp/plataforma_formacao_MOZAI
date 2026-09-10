/**
 * Diagnóstico das variáveis de ambiente.
 *
 * A pergunta que uma página destas tem de responder quase sempre é *"a variável X está
 * definida neste ambiente?"* — e essa responde-se sem mostrar segredo nenhum. Os valores
 * completos vivem noutra rota, pedida uma a uma e registada em auditoria.
 *
 * Os dois avisos que aqui estão não são teóricos: ambos partiram esta plataforma em
 * produção. Um espaço no fim de uma chave, e um valor que começa por `/` convertido em
 * caminho do Windows por um shell MSYS (ver `docs/DEPLOYMENT.md`).
 */

export type EnvStatus = "definida" | "vazia" | "em-falta";

export interface EnvVarReport {
  key: string;
  status: EnvStatus;
  /** `NEXT_PUBLIC_` chega ao browser; as outras ficam no servidor. */
  publicToBrowser: boolean;
  /** Máscara segura. Valor inteiro só para as públicas, que já não são segredo. */
  preview: string | null;
  length: number;
  avisos: string[];
}

/** Estas nunca se mascaram: são embutidas no bundle e qualquer visitante as consegue ler. */
function isPublic(key: string): boolean {
  return key.startsWith("NEXT_PUBLIC_");
}

/**
 * Mostra o suficiente para reconhecer a chave, e nunca o bastante para a usar: os quatro
 * últimos caracteres. Chaves curtas de mais para mascarar em segurança não mostram nada.
 */
export function maskValue(key: string, value: string): string {
  if (isPublic(key)) return value;
  if (value.length <= 8) return "••••";
  return `••••${value.slice(-4)}`;
}

function analisar(key: string, valorBruto: string | undefined): EnvVarReport {
  const definida = valorBruto !== undefined;
  const valor = valorBruto ?? "";
  const avisos: string[] = [];

  if (definida && valor !== valor.trim()) {
    avisos.push(
      "Tem espaços no início ou no fim. Foi assim que o login parou em produção — a maioria dos serviços não os ignora."
    );
  }

  // Um valor que devia ser uma rota (`/algo`) e chega como `C:/...` passou por um shell
  // MSYS, que converte caminhos absolutos. Acontece ao definir variáveis pelo Git Bash.
  if (definida && /^[A-Za-z]:[\\/]/.test(valor) && /_URL$|_PATH$|_REDIRECT/.test(key)) {
    avisos.push(
      "Parece um caminho do Windows onde devia estar uma rota (ex.: /sign-in). É a conversão de caminhos do Git Bash — redefina esta variável pelo painel da Vercel."
    );
  }

  // O sufixo é testado sem o `NEXT_PUBLIC_`, senão o "PUBLIC" do próprio prefixo activava
  // a excepção pensada para nomes legitimamente públicos (…PUBLISHABLE_KEY) e o aviso
  // nunca dispararia.
  const sufixo = key.replace(/^NEXT_PUBLIC_/, "");
  if (definida && isPublic(key) && /secret|token|password|key/i.test(sufixo) && !/publishable|public/i.test(sufixo)) {
    avisos.push(
      "Tem prefixo NEXT_PUBLIC_ e um nome de segredo: o valor está a ser servido ao browser de toda a gente."
    );
  }

  return {
    key,
    status: !definida ? "em-falta" : valor.length === 0 ? "vazia" : "definida",
    publicToBrowser: isPublic(key),
    preview: definida && valor.length > 0 ? maskValue(key, valor) : null,
    length: valor.length,
    avisos,
  };
}

/**
 * Analisa a lista de variáveis pedida. O catálogo vem do chamador (que o lê do
 * `.env.example`), para não haver aqui uma segunda lista a divergir da primeira.
 */
export function inspectEnv(keys: string[]): EnvVarReport[] {
  return keys.map((key) => analisar(key, process.env[key]));
}

/**
 * Nomes de variáveis declarados num ficheiro `.env.example`. Serve de catálogo do que a
 * aplicação espera — é o único sítio onde essa lista já existe, e mantê-la aqui outra vez
 * garantia apenas que as duas divergiriam.
 */
export function parseEnvExampleKeys(conteudo: string): string[] {
  const keys: string[] = [];
  for (const linha of conteudo.split("\n")) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const eq = limpa.indexOf("=");
    if (eq <= 0) continue;
    const key = limpa.slice(0, eq).trim();
    if (/^[A-Z][A-Z0-9_]*$/.test(key) && !keys.includes(key)) keys.push(key);
  }
  return keys;
}
