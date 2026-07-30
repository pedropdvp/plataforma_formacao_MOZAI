import { createHash } from "crypto";

export function hashFlag(flag: string): string {
  return createHash("sha256").update(flag.trim().toLowerCase()).digest("hex");
}

export interface CtfChallenge {
  id: string;
  title: string;
  category: string;
  difficulty: "Fácil" | "Médio" | "Difícil";
  points: number;
  prompt: string;
  flagHash: string;
}

/**
 * Desafios CTF autocontidos e seguros — nada aqui ataca infraestrutura real ou de terceiros;
 * são exercícios estáticos (decifrar, analisar um snippet, calcular um hash) com uma "flag"
 * verificável. A flag nunca é enviada ao cliente — só o seu hash SHA-256 é guardado aqui, e a
 * verificação (submit) compara o hash do que o aluno submete.
 */
export const CTF_CHALLENGES: CtfChallenge[] = [
  {
    id: "b64-basico",
    title: "Decodificação Base64",
    category: "Criptografia",
    difficulty: "Fácil",
    points: 10,
    prompt: 'Decodifica a seguinte string Base64 e submete o resultado como flag:\n\n"TU9aQUlfQ1RGXzEyMw=="',
    flagHash: hashFlag("MOZAI_CTF_123"),
  },
  {
    id: "cesar-cifra",
    title: "Cifra de César",
    category: "Criptografia",
    difficulty: "Fácil",
    points: 15,
    prompt: 'O texto seguinte foi cifrado com uma Cifra de César de deslocamento 3 (A→D, B→E...). Decifra-o:\n\n"PRCDL FHJXUR"',
    flagHash: hashFlag("MOZAI SEGURO"),
  },
  {
    id: "hardcoded-secret",
    title: "Segredo Escondido no Código",
    category: "Segurança de Código",
    difficulty: "Médio",
    points: 20,
    prompt: `Encontra a chave de API hardcoded neste snippet e submete-a como flag:\n\nconst config = {\n  env: "production",\n  apiKey: "sk_live_MZ4I_9f7a2c8d1e",\n  timeout: 30000,\n};`,
    flagHash: hashFlag("sk_live_MZ4I_9f7a2c8d1e"),
  },
  {
    id: "hash-sha256",
    title: "Verificação de Integridade (SHA-256)",
    category: "Criptografia",
    difficulty: "Médio",
    points: 20,
    prompt: 'Calcula o hash SHA-256 (em hexadecimal, minúsculas) da string exata "mozai" e submete-o como flag.',
    flagHash: hashFlag(createHash("sha256").update("mozai").digest("hex")),
  },
  {
    id: "jwt-none-alg",
    title: "JWT com Algoritmo 'none'",
    category: "Autenticação",
    difficulty: "Difícil",
    points: 30,
    prompt:
      'Um sistema aceita JWTs sem verificar o campo "alg" do header. Qual é o nome da vulnerabilidade/técnica de ataque que explora isto (em inglês, duas palavras, tudo minúsculas, separadas por espaço)? Ex: "algorithm X"',
    flagHash: hashFlag("alg confusion"),
  },
];

export function getPublicChallenges() {
  return CTF_CHALLENGES.map(({ id, title, category, difficulty, points, prompt }) => ({ id, title, category, difficulty, points, prompt }));
}

export function getChallenge(id: string): CtfChallenge | undefined {
  return CTF_CHALLENGES.find((c) => c.id === id);
}
