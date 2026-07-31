import { sanityClient } from "@/lib/sanity";

export const runtime = "nodejs";

const WIDGET_QUERY = `
  *[_type == "course"] | order(title asc) [0...12] {
    _id, title, description, "category": coalesce(category->title, "Formação")
  }
`;

/**
 * Widget público embutível (via <iframe>) do catálogo de cursos — não exige autenticação
 * nem cookies de sessão, real e leve. Uso: <iframe src="https://.../widget/catalog">.
 */
export default async function CatalogWidgetPage() {
  let courses: any[] = [];
  try {
    courses = await sanityClient.fetch(WIDGET_QUERY);
  } catch {
    courses = [];
  }

  return (
    <div style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0b1120", color: "#e2e8f0", padding: 16, minHeight: "100vh" }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: "#818cf8" }}>Catálogo MOZAI</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {courses.length === 0 ? (
          <span style={{ fontSize: 12, color: "#64748b" }}>Sem cursos publicados.</span>
        ) : (
          courses.map((c: any) => (
            <div key={c._id} style={{ border: "1px solid #1e293b", borderRadius: 12, padding: 12 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#818cf8", textTransform: "uppercase" }}>{c.category}</span>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{c.title}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, lineHeight: 1.4 }}>{c.description}</div>
            </div>
          ))
        )}
      </div>
      <a href="https://plataforma-formacao-mozai.vercel.app" target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#6366f1", display: "block", marginTop: 12 }}>
        Ver catálogo completo em MOZAI →
      </a>
    </div>
  );
}
