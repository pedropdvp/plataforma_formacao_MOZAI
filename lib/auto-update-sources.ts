export interface AutoUpdateSource {
  id: string;
  label: string;
  type: "github" | "arxiv";
  target: string; // "owner/repo" para GitHub, query de pesquisa para arXiv
}

/** Fontes reais monitorizadas — APIs públicas, sem chave. */
export const AUTO_UPDATE_SOURCES: AutoUpdateSource[] = [
  { id: "gh-nextjs", label: "GitHub Releases: vercel/next.js", type: "github", target: "vercel/next.js" },
  { id: "gh-solidity", label: "GitHub Releases: ethereum/solidity", type: "github", target: "ethereum/solidity" },
  { id: "gh-openai-node", label: "GitHub Releases: openai/openai-node", type: "github", target: "openai/openai-node" },
  { id: "arxiv-cs-lg", label: "arXiv Preprints (cs.LG — Machine Learning)", type: "arxiv", target: "cat:cs.LG" },
];

interface FetchedItem {
  externalId: string;
  title: string;
  description: string;
  url: string;
  publishedAt: string;
}

/** Busca real ao GitHub Releases (API pública, sem autenticação para repositórios públicos). */
async function fetchGithubReleases(repo: string): Promise<FetchedItem[]> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=3`, {
    headers: { Accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`GitHub devolveu HTTP ${res.status} para ${repo}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((r: any) => ({
    externalId: `gh:${repo}:${r.id}`,
    title: `${repo}: ${r.name || r.tag_name}`,
    description: (r.body || "Sem notas de lançamento.").slice(0, 1000),
    url: r.html_url,
    publishedAt: r.published_at,
  }));
}

/** Busca real à API pública do arXiv (Atom XML, sem autenticação). */
async function fetchArxiv(query: string): Promise<FetchedItem[]> {
  const res = await fetch(
    `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&sortBy=submittedDate&sortOrder=descending&max_results=3`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) throw new Error(`arXiv devolveu HTTP ${res.status}`);
  const xml = await res.text();

  const entries = xml.split("<entry>").slice(1);
  return entries.map((entry) => {
    const get = (tag: string) => entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1]?.trim() || "";
    const id = get("id");
    return {
      externalId: `arxiv:${id}`,
      title: get("title").replace(/\s+/g, " "),
      description: get("summary").replace(/\s+/g, " ").slice(0, 1000),
      url: id,
      publishedAt: get("published"),
    };
  });
}

export async function fetchSourceItems(source: AutoUpdateSource): Promise<FetchedItem[]> {
  return source.type === "github" ? fetchGithubReleases(source.target) : fetchArxiv(source.target);
}
