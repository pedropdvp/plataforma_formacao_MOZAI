import { redirect } from "next/navigation";

/**
 * O Fórum era uma maqueta: os três fóruns que aparecia a listar estavam escritos no código,
 * as contagens de tópicos eram números fixos e o botão de entrar apenas mostrava um aviso.
 * As discussões acontecem nos Grupos, que guardam publicações, respostas e gostos de verdade.
 *
 * A página fica como encaminhamento — e não simplesmente apagada — porque o endereço antigo
 * pode estar num favorito ou num documento, e assim leva a quem quer chegar em vez de dar
 * uma página que não existe.
 */
export default function ForumPage() {
  redirect("/dashboard/groups");
}
