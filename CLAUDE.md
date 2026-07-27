# Instruções para Claude Code

## Idioma de comunicação

Todas as respostas do Claude Code ao utilizador neste projeto — mensagens de conversa,
explicações, resumos, perguntas — devem ser sempre escritas em Português de Portugal,
exceto quando o utilizador pedir explicitamente outro idioma numa mensagem concreta.
Esta regra aplica-se à comunicação em si, não só ao código/texto gerado (ver ponto 16
abaixo, que cobre especificamente esse caso).

## Antes de gerar qualquer código

1. Ler todos os ficheiros da pasta `docs`.
2. Respeitar o conteúdo de `TECH_STACK.md`.
3. Respeitar o conteúdo de `ARCHITECTURE.md`.
4. Respeitar o conteúdo de `DATABASE_RULES.md`.
5. Nunca alterar a stack tecnológica.
6. Nunca utilizar tecnologias não autorizadas.
7. Produzir código de nível empresarial.
8. Produzir código compatível com Java 21.
9. Produzir código compatível com Spring Boot 3.
10. Seguir os princípios SOLID.
11. Seguir Clean Code.
12. Seguir Clean Architecture.
13. Implementar RBAC em todo o sistema.
14. Todas as entidades devem suportar Multi-Tenant.
15. Todo o código deve estar preparado para produção.
16. Escrever sempre em Português de Portugal, exceto quando existir uma instrução explícita para utilizar outro idioma.

## Documentação adicional

- `AGENTS.md`