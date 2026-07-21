export default {
  name: "module",
  title: "Módulo",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Título do Módulo",
      type: "string",
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "order",
      title: "Ordem / Sequência",
      type: "number",
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "lessons",
      title: "Lições associadas",
      type: "array",
      of: [
        {
          type: "reference",
          to: [{ type: "lesson" }],
        },
      ],
      validation: (Rule: any) => Rule.required(),
    },
  ],
};
