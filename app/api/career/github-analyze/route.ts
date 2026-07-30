import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

interface GithubRepo {
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  pushed_at: string;
}

// Cabeçalhos comuns para a API pública do GitHub — GITHUB_TOKEN é opcional (só sobe o
// limite de 60 para 5000 pedidos/hora); a análise funciona sem qualquer chave configurada.
function githubHeaders(): HeadersInit {
  const headers: HeadersInit = { Accept: "application/vnd.github+json", "User-Agent": "MOZAI-Career-OS" };
  if (process.env.GITHUB_TOKEN) headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

// POST — Analisa um perfil PÚBLICO real do GitHub via api.github.com (sem scraping —
// é a API oficial e legítima, ao contrário da LinkedIn, que bloqueia acesso automático).
// Nunca inventa estatísticas: se o utilizador não existir ou não tiver repositórios
// públicos, devolve exatamente isso, sem fabricar dados.
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Autenticação obrigatória." }, { status: 401 });
    }

    const { username } = await req.json();
    const cleanUsername = (username || "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?github\.com\//i, "").split("/")[0];
    if (!cleanUsername) {
      return NextResponse.json({ error: "Indique um nome de utilizador do GitHub válido." }, { status: 400 });
    }

    const profileRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`, {
      headers: githubHeaders(),
    });

    if (profileRes.status === 404) {
      return NextResponse.json({ error: `Não existe nenhum utilizador "${cleanUsername}" no GitHub.` }, { status: 404 });
    }
    if (profileRes.status === 403) {
      return NextResponse.json(
        { error: "Limite de pedidos à API do GitHub excedido. Tente novamente dentro de alguns minutos." },
        { status: 429 }
      );
    }
    if (!profileRes.ok) {
      return NextResponse.json({ error: `O GitHub devolveu um erro (${profileRes.status}).` }, { status: 502 });
    }

    const profile = await profileRes.json();

    const reposRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?sort=pushed&per_page=100`,
      { headers: githubHeaders() }
    );
    const repos: GithubRepo[] = reposRes.ok ? await reposRes.json() : [];

    // Linguagens por contagem de repositórios (proxy real e honesto — a métrica exata em
    // bytes exigiria 1 pedido extra por repositório, o que esgotaria o limite da API
    // pública rapidamente para perfis com muitos repositórios).
    const languageCounts: Record<string, number> = {};
    let totalStars = 0;
    const ownRepos = repos.filter((r) => !r.fork);

    ownRepos.forEach((r) => {
      if (r.language) languageCounts[r.language] = (languageCounts[r.language] || 0) + 1;
      totalStars += r.stargazers_count || 0;
    });

    const topLanguages = Object.entries(languageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count }));

    const topRepos = [...ownRepos]
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 5)
      .map((r) => ({
        name: r.name,
        description: r.description,
        url: r.html_url,
        language: r.language,
        stars: r.stargazers_count,
      }));

    return NextResponse.json({
      success: true,
      profile: {
        login: profile.login,
        name: profile.name,
        bio: profile.bio,
        avatarUrl: profile.avatar_url,
        htmlUrl: profile.html_url,
        publicRepos: profile.public_repos,
        followers: profile.followers,
        following: profile.following,
        createdAt: profile.created_at,
      },
      totalStars,
      topLanguages,
      topRepos,
    });
  } catch (error: any) {
    console.error("Erro ao analisar perfil de GitHub:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
