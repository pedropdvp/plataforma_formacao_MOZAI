export default {
  name: "course",
  title: "Curso",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Título do Curso",
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
      name: "description",
      title: "Descrição do Curso",
      type: "text",
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "coverImage",
      title: "Imagem de Capa",
      type: "image",
      options: {
        hotspot: true,
      },
    },
    {
      name: "category",
      title: "Categoria do Curso",
      type: "reference",
      to: [{ type: "category" }],
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "modules",
      title: "Módulos do Curso",
      type: "array",
      of: [
        {
          type: "reference",
          to: [{ type: "module" }],
        },
      ],
      validation: (Rule: any) => Rule.required(),
    },
  ],
};
