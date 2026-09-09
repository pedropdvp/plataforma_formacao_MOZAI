import { createHash, randomInt } from "crypto";

export function hashFlag(flag: string): string {
  return createHash("sha256").update(flag.trim().toLowerCase()).digest("hex");
}

export interface CtfChallenge {
  /** Identificador desta instância concreta (tipo + semente). Muda a cada geração. */
  id: string;
  /** Tipo de desafio, estável entre gerações — é por ele que se contam os pontos. */
  typeId: string;
  title: string;
  category: string;
  difficulty: "Fácil" | "Médio" | "Difícil";
  points: number;
  prompt: string;
  flagHash: string;
}

/** O que um gerador devolve; o `flagHash` é calculado depois, uma vez só. */
interface Variante {
  prompt: string;
  flag: string;
}

interface CtfGenerator {
  typeId: string;
  title: string;
  category: string;
  difficulty: "Fácil" | "Médio" | "Difícil";
  points: number;
  build: (r: Rng) => Variante;
}

/**
 * Gerador de números pseudo-aleatórios com semente (mulberry32).
 *
 * Tem de ser determinístico: a mesma semente reproduz o mesmo conjunto de desafios, o que
 * permite guardar só a semente e voltar a construí-los, e torna um problema reproduzível
 * quando alguém reportar que uma pergunta está errada. `Math.random()` não daria isso.
 */
type Rng = {
  int: (max: number) => number;
  pick: <T>(items: readonly T[]) => T;
};

function makeRng(seed: number): Rng {
  let estado = seed >>> 0;
  const proximo = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    int: (max: number) => Math.floor(proximo() * max),
    pick: <T,>(items: readonly T[]) => items[Math.floor(proximo() * items.length)],
  };
}

const PALAVRAS = [
  "MOZAI", "SEGURO", "MAPUTO", "BEIRA", "NAMPULA", "ZAMBEZE", "INHAMBANE",
  "CIFRA", "CHAVE", "ESCUDO", "FIREWALL", "SENHA", "TOKEN", "AUDITORIA",
] as const;

const FRASES = [
  "MOZAI SEGURO", "GUARDA A CHAVE", "CIFRA TUDO", "NUNCA CONFIES",
  "VERIFICA SEMPRE", "SENHA FORTE", "ACESSO NEGADO", "DEFESA EM CAMADAS",
] as const;

function cifraCesar(texto: string, desvio: number): string {
  return texto.replace(/[A-Z]/g, (c) =>
    String.fromCharCode(((c.charCodeAt(0) - 65 + desvio) % 26) + 65)
  );
}

function sufixo(r: Rng, tamanho: number): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: tamanho }, () => alfabeto[r.int(alfabeto.length)]).join("");
}

/**
 * Cada gerador produz uma variante nova a partir da semente, e **calcula a resposta em
 * código** em vez de a ter escrita ao lado da pergunta. É o que garante que uma questão
 * gerada está sempre certa — um modelo de linguagem a inventar enunciados daria variedade
 * maior, mas um hash SHA-256 alucinado transforma um exercício num beco sem saída.
 */
const GENERATORS: CtfGenerator[] = [
  {
    typeId: "b64-basico",
    title: "Decodificação Base64",
    category: "Criptografia",
    difficulty: "Fácil",
    points: 10,
    build: (r) => {
      const flag = `MOZAI_${r.pick(PALAVRAS)}_${r.int(900) + 100}`;
      return {
        prompt: `Decodifica a seguinte string Base64 e submete o resultado como flag:\n\n"${Buffer.from(flag).toString("base64")}"`,
        flag,
      };
    },
  },
  {
    typeId: "hex-ascii",
    title: "Hexadecimal para Texto",
    category: "Criptografia",
    difficulty: "Fácil",
    points: 10,
    build: (r) => {
      const flag = `MOZAI_${r.pick(PALAVRAS)}`;
      const hex = Buffer.from(flag).toString("hex").match(/.{2}/g)!.join(" ");
      return {
        prompt: `Estes bytes estão em hexadecimal. Converte-os para texto e submete o resultado:\n\n${hex}`,
        flag,
      };
    },
  },
  {
    typeId: "cesar-cifra",
    title: "Cifra de César",
    category: "Criptografia",
    difficulty: "Fácil",
    points: 15,
    build: (r) => {
      const desvio = r.int(24) + 2; // evita 0 e 1, que quase não cifram
      const flag = r.pick(FRASES);
      const letra = String.fromCharCode(65 + desvio);
      return {
        prompt: `O texto seguinte foi cifrado com uma Cifra de César de deslocamento ${desvio} (A→${letra}). Decifra-o:\n\n"${cifraCesar(flag, desvio)}"`,
        flag,
      };
    },
  },
  {
    typeId: "xor-chave",
    title: "XOR de Chave Única",
    category: "Criptografia",
    difficulty: "Médio",
    points: 20,
    build: (r) => {
      const chave = r.int(200) + 20;
      const flag = r.pick(FRASES);
      const cifrado = Array.from(Buffer.from(flag))
        .map((b) => (b ^ chave).toString(16).padStart(2, "0"))
        .join(" ");
      return {
        prompt: `Este texto foi cifrado byte a byte com XOR usando a chave 0x${chave.toString(16).padStart(2, "0")}. Decifra-o e submete o texto original:\n\n${cifrado}`,
        flag,
      };
    },
  },
  {
    typeId: "url-encode",
    title: "Percent-Encoding em URL",
    category: "Web",
    difficulty: "Fácil",
    points: 10,
    build: (r) => {
      const flag = `${r.pick(FRASES)} ${r.int(90) + 10}`;
      return {
        prompt: `Um parâmetro de query chegou codificado assim. Descodifica-o e submete o valor original:\n\n${encodeURIComponent(flag)}`,
        flag,
      };
    },
  },
  {
    typeId: "hardcoded-secret",
    title: "Segredo Escondido no Código",
    category: "Segurança de Código",
    difficulty: "Médio",
    points: 20,
    build: (r) => {
      const flag = `sk_live_MZ${sufixo(r, 4)}_${sufixo(r, 10).toLowerCase()}`;
      return {
        prompt: `Encontra a chave de API hardcoded neste snippet e submete-a como flag:\n\nconst config = {\n  env: "production",\n  retries: ${r.int(5) + 1},\n  apiKey: "${flag}",\n  timeout: ${(r.int(6) + 1) * 5000},\n};`,
        flag,
      };
    },
  },
  {
    typeId: "hash-sha256",
    title: "Verificação de Integridade (SHA-256)",
    category: "Criptografia",
    difficulty: "Médio",
    points: 20,
    build: (r) => {
      const entrada = `${r.pick(PALAVRAS).toLowerCase()}${r.int(1000)}`;
      return {
        prompt: `Calcula o hash SHA-256 (em hexadecimal, minúsculas) da string exata "${entrada}" e submete-o como flag.`,
        flag: createHash("sha256").update(entrada).digest("hex"),
      };
    },
  },
  {
    typeId: "permissoes-unix",
    title: "Permissões de Ficheiro Unix",
    category: "Sistemas",
    difficulty: "Médio",
    points: 15,
    build: (r) => {
      const modo = [r.int(8), r.int(8), r.int(8)];
      const simbolico = modo
        .map((d) => `${d & 4 ? "r" : "-"}${d & 2 ? "w" : "-"}${d & 1 ? "x" : "-"}`)
        .join("");
      return {
        prompt: `O comando "ls -l" mostra as permissões abaixo. Submete o equivalente em notação octal (três dígitos, ex: 644):\n\n-${simbolico}`,
        flag: modo.join(""),
      };
    },
  },
  {
    typeId: "atbash",
    title: "Cifra de Atbash",
    category: "Criptografia",
    difficulty: "Médio",
    points: 15,
    build: (r) => {
      const flag = r.pick(FRASES);
      const atbash = (txt: string) =>
        txt.replace(/[A-Z]/g, (c) => String.fromCharCode(155 - c.charCodeAt(0)));
      return {
        prompt: `Este texto foi cifrado com a cifra de Atbash, que troca A por Z, B por Y, e assim por diante. Decifra-o:

"${atbash(flag)}"`,
        flag,
      };
    },
  },
  {
    typeId: "binario-decimal",
    title: "Binário para Decimal",
    category: "Sistemas",
    difficulty: "Fácil",
    points: 10,
    build: (r) => {
      const valor = r.int(200) + 28;
      return {
        prompt: `Converte este número binário para decimal e submete o resultado:

${valor.toString(2).padStart(8, "0")}`,
        flag: String(valor),
      };
    },
  },
  {
    typeId: "cidr-hosts",
    title: "Endereçamento CIDR",
    category: "Redes",
    difficulty: "Médio",
    points: 20,
    build: (r) => {
      const prefixo = r.int(6) + 24; // /24 a /29
      const rede = `10.${r.int(256)}.${r.int(256)}.0`;
      return {
        prompt: `Quantos endereços IP utilizáveis (excluindo o de rede e o de broadcast) existem na sub-rede ${rede}/${prefixo}? Submete apenas o número.`,
        flag: String(2 ** (32 - prefixo) - 2),
      };
    },
  },
  {
    typeId: "conceito-seguranca",
    title: "Conceitos de Segurança",
    category: "Autenticação",
    difficulty: "Difícil",
    points: 30,
    build: (r) => {
      const perguntas = [
        {
          prompt:
            'Um sistema aceita JWTs sem verificar o campo "alg" do header. Qual é o nome da técnica de ataque que explora isto (em inglês, duas palavras, minúsculas, separadas por espaço)?',
          flag: "alg confusion",
        },
        {
          prompt:
            "Uma consulta constrói SQL concatenando input do utilizador. Qual é o nome do ataque que isto permite (em inglês, duas palavras, minúsculas)?",
          flag: "sql injection",
        },
        {
          prompt:
            "Um site aceita pedidos autenticados vindos de outro domínio sem token de verificação. Qual é a sigla desta vulnerabilidade (4 letras, minúsculas)?",
          flag: "csrf",
        },
        {
          prompt:
            "Um formulário devolve input do utilizador sem escapar HTML, permitindo executar JavaScript no browser de outras pessoas. Qual é a sigla desta vulnerabilidade (3 letras, minúsculas)?",
          flag: "xss",
        },
        {
          prompt:
            "Guardar palavras-passe cifradas com SHA-256 sem mais nada é insuficiente. Que valor aleatório se deve juntar a cada palavra-passe antes do hash (uma palavra, em inglês, minúsculas)?",
          flag: "salt",
        },
        {
          prompt:
            "Um endpoint deixa um utilizador ler o registo de outro trocando o id no URL. Qual é a sigla desta falha de controlo de acesso (4 letras, minúsculas)?",
          flag: "idor",
        },
      ];
      return r.pick(perguntas);
    },
  },
];

/** Quantos desafios compõem um conjunto. Menos do que os geradores disponíveis, para que
 *  gerar de novo mude também *quais* aparecem, e não só os valores lá dentro. */
export const CHALLENGES_POR_CONJUNTO = 6;

export function novaSemente(): number {
  return randomInt(1, 2 ** 31);
}

/**
 * Escolhe que tipos entram num conjunto, dando prioridade aos que o utilizador ainda não
 * pontuou — gerar questões novas deve trazer sobretudo material por fazer. Quando os
 * tipos por pontuar não chegam para encher o conjunto, completa-se com os restantes: são
 * variantes novas do mesmo exercício, e continuam a servir para treinar.
 */
export function sortearTipos(seed: number, tiposJaPontuados: string[] = []): string[] {
  const r = makeRng(seed);
  const pontuados = new Set(tiposJaPontuados);

  const baralhar = (items: CtfGenerator[]) => {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = r.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const porFazer = baralhar(GENERATORS.filter((g) => !pontuados.has(g.typeId)));
  const feitos = baralhar(GENERATORS.filter((g) => pontuados.has(g.typeId)));
  return [...porFazer, ...feitos].slice(0, CHALLENGES_POR_CONJUNTO).map((g) => g.typeId);
}

/**
 * Constrói o conjunto a partir da semente e da lista de tipos.
 *
 * Os tipos vêm de fora, e não de um sorteio aqui dentro, porque o sorteio depende do que o
 * utilizador já pontuou — que muda com o tempo. Se dependesse disso, reconstruir o conjunto
 * mais tarde para validar uma submissão podia devolver desafios diferentes dos que a pessoa
 * tem no ecrã. Guardando os tipos ao lado da semente, a reconstrução é sempre a mesma.
 */
export function generateChallengeSet(seed: number, typeIds: string[]): CtfChallenge[] {
  const r = makeRng(seed);

  return typeIds
    .map((id) => GENERATORS.find((g) => g.typeId === id))
    .filter((g): g is CtfGenerator => Boolean(g))
    .map((g) => {
      const variante = g.build(r);
      return {
        id: `${g.typeId}-${seed.toString(36)}`,
        typeId: g.typeId,
        title: g.title,
        category: g.category,
        difficulty: g.difficulty,
        points: g.points,
        prompt: variante.prompt,
        flagHash: hashFlag(variante.flag),
      };
    });
}

/**
 * Versão segura para enviar ao cliente. Os campos são listados um a um de propósito: com
 * um "resto" do objecto, um campo sensível acrescentado ao `CtfChallenge` no futuro
 * passaria a ser publicado sem ninguém dar por isso.
 */
export function toPublicChallenge(c: CtfChallenge) {
  return {
    id: c.id,
    typeId: c.typeId,
    title: c.title,
    category: c.category,
    difficulty: c.difficulty,
    points: c.points,
    prompt: c.prompt,
  };
}
