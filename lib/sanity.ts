import { createClient } from "next-sanity";
import imageUrlBuilder from "@sanity/image-url";

const projectId = process.env.SANITY_PROJECT_ID || "dummy-project-id";
const dataset = process.env.SANITY_DATASET || "production";
const apiVersion = "2023-05-03";

export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: process.env.NODE_ENV === "production",
});

const builder = imageUrlBuilder(sanityClient);

export function urlFor(source: any) {
  return builder.image(source);
}

/**
 * GROQ query para recuperar detalhes completos de um curso, incluindo módulos e lições.
 * Evita o problema de N+1 queries projetando as referências aninhadas.
 */
export const GET_COURSE_BY_SLUG_QUERY = `
  *[_type == "course" && slug.current == $slug][0] {
    _id,
    title,
    description,
    slug,
    coverImage,
    "category": category->title,
    "modules": modules[]-> {
      _id,
      title,
      order,
      "lessons": lessons[]-> {
        _id,
        title,
        slug,
        duration,
        videoProvider,
        videoId,
        isFree
      }
    }
  }
`;

/**
 * GROQ query para recuperar um curso pelo seu _id (usado nas rotas /dashboard/courses/[courseId]).
 * Devolve os módulos ordenados e as lições com metadados de navegação.
 */
export const GET_COURSE_BY_ID_QUERY = `
  *[_type == "course" && _id == $id][0] {
    _id,
    title,
    description,
    "modules": modules[]-> | order(order asc) {
      _id,
      title,
      order,
      "lessons": lessons[]-> {
        _id,
        title,
        "slug": slug.current,
        duration,
        videoProvider,
        videoId,
        isFree
      }
    }
  }
`;

/**
 * GROQ query para obter uma lição específica, contendo o conteúdo estruturado em Portable Text.
 */
export const GET_LESSON_QUERY = `
  *[_type == "lesson" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    duration,
    videoProvider,
    videoId,
    content, // Portable Text (JSON estruturado nativo de IA)
    resources[] {
      title,
      url
    },
    exercises[] {
      question,
      options,
      correctIndex
    }
  }
`;

/**
 * GROQ query para listar todos os cursos disponíveis
 */
export const LIST_COURSES_QUERY = `
  *[_type == "course"] | order(title asc) {
    _id,
    title,
    description,
    slug,
    coverImage,
    "category": category->title
  }
`;
