/**
 * Deteta variáveis num template de prompt no formato {{nome_da_variavel}}, devolvendo
 * a lista de nomes únicos, na ordem em que aparecem.
 */
export function extractPromptVariables(template: string): string[] {
  const matches = template.match(/\{\{\s*([a-zA-Z0-9_À-ÿ ]+?)\s*\}\}/g) || [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const m of matches) {
    const name = m.replace(/\{\{\s*|\s*\}\}/g, "").trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

/** Substitui cada {{variavel}} pelo valor fornecido (ou deixa o placeholder se não houver valor). */
export function fillPromptTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_À-ÿ ]+?)\s*\}\}/g, (_match, name) => {
    const key = name.trim();
    return values[key] !== undefined && values[key] !== "" ? values[key] : `{{${key}}}`;
  });
}
