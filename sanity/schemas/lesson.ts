export default {
  name: "lesson",
  title: "Lição",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Título da Lição",
      type: "string",
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title",
        maxLength: 96,
      },
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "duration",
      title: "Duração (em minutos)",
      type: "number",
      validation: (Rule: any) => Rule.min(0),
    },
    {
      name: "videoProvider",
      title: "Provedor de Vídeo",
      type: "string",
      options: {
        list: [
          { title: "Mux", value: "mux" },
          { title: "Cloudinary VOD", value: "cloudinary" },
          { title: "YouTube", value: "youtube" },
        ],
      },
      initialValue: "mux",
    },
    {
      name: "videoId",
      title: "ID do Vídeo (Playback ID / URL)",
      type: "string",
    },
    {
      name: "content",
      title: "Conteúdo da Lição",
      description: "Conteúdo estruturado em Portable Text - essencial para a leitura e RAG da IA.",
      type: "array",
      of: [
        { type: "block" },
        {
          type: "code",
          title: "Bloco de Código Executável",
        },
        {
          type: "image",
          options: { hotspot: true },
        },
      ],
    },
    {
      name: "isFree",
      title: "Acesso Gratuito (Free Tier)",
      type: "boolean",
      initialValue: false,
    },
    {
      name: "resources",
      title: "Materiais de Apoio",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "title", title: "Título do Recurso", type: "string" },
            { name: "url", title: "URL", type: "string" },
          ],
        },
      ],
    },
    {
      name: "exercises",
      title: "Exercícios (Quizzes)",
      type: "array",
      of: [
        {
          type: "object",
          name: "quiz",
          title: "Quiz",
          fields: [
            { name: "question", title: "Pergunta", type: "string" },
            {
              name: "options",
              title: "Opções de Resposta",
              type: "array",
              of: [{ type: "string" }],
            },
            {
              name: "correctIndex",
              title: "Índice da Resposta Correta (0-index)",
              type: "number",
            },
          ],
        },
      ],
    },
  ],
};
