export interface ScanRule {
  id: string;
  name: string;
  severity: "crítico" | "alto" | "médio" | "baixo";
  pattern: RegExp;
  description: string;
}

export interface ScanFinding {
  ruleId: string;
  name: string;
  severity: ScanRule["severity"];
  description: string;
  line: number;
  snippet: string;
}

/**
 * Regras de deteção REAIS baseadas em expressões regulares — cada match é um padrão que
 * realmente existe no código submetido, nunca um resultado inventado. Cobre as classes de
 * vulnerabilidade mais comuns (OWASP-style) que dá para detetar de forma determinística por
 * padrão de texto, sem executar o código.
 */
export const SCAN_RULES: ScanRule[] = [
  {
    id: "sql-concat",
    name: "Possível SQL Injection (concatenação de query)",
    severity: "crítico",
    pattern: /(SELECT|INSERT|UPDATE|DELETE)[^"'`]*["'`]\s*\+|["'`]\s*\+\s*.*\b(SELECT|INSERT|UPDATE|DELETE)\b/i,
    description: "Query SQL construída por concatenação de strings em vez de parâmetros preparados.",
  },
  {
    id: "eval-usage",
    name: "Uso de eval()/Function() dinâmico",
    severity: "crítico",
    pattern: /\beval\s*\(|new\s+Function\s*\(/,
    description: "Execução de código dinâmico a partir de uma string — vetor clássico de injeção de código.",
  },
  {
    id: "hardcoded-secret",
    name: "Segredo aparentemente hardcoded",
    severity: "alto",
    pattern: /(api[_-]?key|secret|password|senha|token)\s*[:=]\s*["'`][A-Za-z0-9_\-]{8,}["'`]/i,
    description: "Valor que parece ser uma chave/segredo escrito diretamente no código-fonte.",
  },
  {
    id: "weak-hash",
    name: "Algoritmo de hash fraco para senhas",
    severity: "alto",
    pattern: /\b(md5|sha1)\s*\(/i,
    description: "MD5/SHA-1 não são adequados para hashing de passwords (sem salt/custo computacional) — usar bcrypt/argon2.",
  },
  {
    id: "innerhtml",
    name: "Possível XSS via innerHTML",
    severity: "médio",
    pattern: /\.innerHTML\s*=/,
    description: "Atribuição direta a innerHTML com dados que podem não estar sanitizados — risco de XSS.",
  },
  {
    id: "insecure-random",
    name: "Math.random() usado em contexto sensível",
    severity: "médio",
    pattern: /\bMath\.random\s*\(\s*\)/,
    description: "Math.random() não é criptograficamente seguro — não usar para tokens, senhas ou chaves.",
  },
  {
    id: "disabled-tls-verify",
    name: "Verificação TLS desativada",
    severity: "crítico",
    pattern: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/,
    description: "Desativar a verificação de certificados TLS expõe a ligação a ataques man-in-the-middle.",
  },
  {
    id: "command-injection",
    name: "Possível Command Injection",
    severity: "crítico",
    pattern: /\b(exec|execSync|spawn)\s*\([^)]*\+/,
    description: "Execução de comando de sistema construído com concatenação de input — risco de injeção de comandos.",
  },
];

/** Corre todas as regras reais sobre o código submetido, devolvendo os matches com número de linha. */
export function scanCodeForVulnerabilities(code: string): ScanFinding[] {
  const lines = code.split("\n");
  const findings: ScanFinding[] = [];

  for (const rule of SCAN_RULES) {
    lines.forEach((lineText, idx) => {
      if (rule.pattern.test(lineText)) {
        findings.push({
          ruleId: rule.id,
          name: rule.name,
          severity: rule.severity,
          description: rule.description,
          line: idx + 1,
          snippet: lineText.trim().slice(0, 160),
        });
      }
    });
  }

  return findings;
}
