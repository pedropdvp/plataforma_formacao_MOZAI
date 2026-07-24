// @vercel/blob importa `fetch` de "undici" (um cliente HTTP só para Node) de forma
// incondicional, mesmo no build de browser (não expõe nenhuma condição "browser" no seu
// package.json). Quando esse import é incluído no bundle do cliente, o `fetch` do undici
// fica com dependências internas do Node por preencher e o pedido real (o PUT do ficheiro
// para o Vercel Blob) fica pendurado para sempre em vez de responder ou dar erro — foi isto
// que impedia por completo o upload de PDF/PPTX na Fábrica de Cursos, sem qualquer erro
// visível. Este ficheiro substitui "undici" pelo fetch nativo do browser SÓ no bundle do
// cliente (ver `turbopack.resolveAlias` em next.config.ts) — o servidor continua a usar o
// pacote "undici" real e inalterado (necessário para outras dependências, como o jsdom
// usado em app/api/admin/courses/generate/import-url/route.ts).
export const fetch = globalThis.fetch;
