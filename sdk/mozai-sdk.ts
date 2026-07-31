/**
 * SDK oficial (TypeScript) da API pública da MOZAI — cliente fino sobre fetch, sem
 * dependências. Não está publicado no npm (isso exigiria um processo de publicação e
 * manutenção próprios, fora de âmbito); é distribuído como código-fonte real neste
 * repositório (`/sdk`), importável diretamente num projeto Node/TypeScript.
 *
 * Uso:
 *   import { MozaiClient } from "./sdk/mozai-sdk";
 *   const client = new MozaiClient({ apiKey: "mozai_...", baseUrl: "https://plataforma-formacao-mozai.vercel.app" });
 *   const { result } = await client.runPrompt("PROMPT_ID", { tema: "vendas" });
 */

export interface MozaiClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class MozaiApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "MozaiApiError";
  }
}

export class MozaiClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: MozaiClientOptions) {
    if (!options.apiKey?.startsWith("mozai_")) {
      throw new Error("MozaiClient: apiKey inválida (deve começar por 'mozai_').");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || "https://plataforma-formacao-mozai.vercel.app").replace(/\/$/, "");
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new MozaiApiError(res.status, data.error || `Erro HTTP ${res.status}`);
    }
    return data as T;
  }

  /** Executa um Prompt real do Marketplace, preenchendo as variáveis {{...}} indicadas. */
  async runPrompt(promptId: string, variables: Record<string, string> = {}): Promise<{ success: true; result: string; creditsRemaining: number }> {
    return this.request(`/api/public/v1/prompts/${promptId}/run`, { variables });
  }
}
