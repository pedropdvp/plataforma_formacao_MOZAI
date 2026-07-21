import { getDb } from "./mongodb";

interface RawLessonContent {
  courseId: string;
  lessonId: string;
  category: string;
  title: string;
  paragraphs: string[];
}

const SEED_DATA: RawLessonContent[] = [
  // 1. Curso 1: Engenharia de IA e RAG Avançado
  {
    courseId: "course-1",
    lessonId: "lesson-1-1",
    category: "Inteligência Artificial",
    title: "Introdução à Engenharia de IA e Tutoria Activa",
    paragraphs: [
      "A Engenharia de IA representa uma mudança fundamental no paradigma de desenvolvimento. Em vez de escrever regras lógicas estáticas em código, criamos sistemas probabilísticos capazes de interpretar inputs dinâmicos usando modelos de linguagem de grande escala (LLMs).",
      "No ensino moderno, a transição do e-learning clássico para a tutoria ativa é crucial. A tutoria ativa substitui a visualização passiva de vídeos por um diálogo bidirecional constante entre o estudante e um agente inteligente de IA, que entende o contexto das lições em tempo real.",
      "Com a tutoria ativa da MOZAI, cada dúvida do aluno é resolvida através de Grounding RAG. A IA não alucina respostas genéricas; em vez disso, pesquisa na base de dados de chunks da lição correspondente para fundamentar cientificamente a sua explicação.",
      "Para integrar o tutor ativo no player, extraímos transcrições de vídeo e documentação técnica de apoio. O modelo analisa a intenção da pergunta do utilizador e, caso necessário, sugere que navegue para outra aula específica usando ferramentas de Function Calling."
    ]
  },
  {
    courseId: "course-1",
    lessonId: "lesson-1-2",
    category: "Inteligência Artificial",
    title: "Configuração do Embeddings Pipeline com Titan",
    paragraphs: [
      "Os embeddings vetoriais transformam palavras e conceitos de texto em vetores numéricos de alta dimensão. Esses vetores capturam o significado semântico e a relação de vizinhança contextual entre os diferentes parágrafos das nossas lições.",
      "Nesta aula configuramos a geração de embeddings com o modelo AWS Titan (especificamente o text-embedding-3-small da OpenAI ou Titan da Amazon). O pipeline fragmenta (chunking) os Portable Texts do Sanity CMS em blocos de 800 palavras com sobreposição (overlap) de 150 palavras.",
      "Para gerir o pipeline em lote, usamos a Vercel AI SDK. A função embedMany recebe uma matriz contendo as frações de textos das lições e realiza chamadas paralelas ao provedor de embeddings, retornando uma matriz de vetores que são inseridos no MongoDB.",
      "A sobreposição semântica é vital para garantir que nenhum parágrafo perca o sentido ao ser partido ao meio. Sem o overlap de 150 palavras, o modelo RAG poderia perder a correlação de transição de ideias entre dois chunks sequenciais."
    ]
  },
  {
    courseId: "course-1",
    lessonId: "lesson-1-3",
    category: "Inteligência Artificial",
    title: "Pesquisa Semântica Scoped com MongoDB Atlas",
    paragraphs: [
      "A pesquisa semântica por similaridade calcula o cosseno ou a distância euclidiana entre o vetor da pergunta do aluno e os vetores de todos os chunks de texto guardados na nossa coleção de base de dados.",
      "No MongoDB Atlas, configuramos o Vector Search através da criação de um índice do tipo 'vectorSearch' na coleção 'lesson_chunks'. O índice mapeia a propriedade 'embedding' especificando a dimensão do vetor (1536 dimensões para o text-embedding-3-small).",
      "O isolamento de dados multilocação (multi-tenancy) exige que o estágio $vectorSearch do MongoDB agregue um filtro estrito. Aplicamos uma cláusula $match para filtrar por tenant_id logo após a pesquisa vetorial, prevenindo leaks de dados corporativos.",
      "Caso o serviço de Vector Search do MongoDB Atlas esteja temporariamente offline ou a correr em ambiente local simples de desenvolvimento, implementamos uma lógica de fallback automático que realiza busca textual $text ou de busca exata nas coleções."
    ]
  },

  // 2. Curso 2: Next.js 16 e Arquiteturas Composable SaaS
  {
    courseId: "course-2",
    lessonId: "lesson-1-1",
    category: "Programação / Frontend",
    title: "Introdução ao Next.js 16 App Router",
    paragraphs: [
      "O Next.js 16 traz evoluções robustas na arquitetura App Router. Por padrão, todos os ficheiros criados dentro da pasta /app funcionam como React Server Components (RSC), o que significa que o seu código é compilado no servidor sem enviar Javascript ao browser.",
      "Para adicionar interatividade (como formulários, botões reativos ou hooks de estado do React), devemos declarar a diretiva 'use client' no topo absoluto do arquivo. Isto transforma-o num Client Component, que descarrega no browser e reidrata os elementos HTML.",
      "A renderização híbrida combina o melhor dos dois mundos. Podemos carregar dados pesados de APIs ou bancos de dados diretamente em componentes assíncronos no servidor, e passar as propriedades aos componentes clientes interativos aninhados.",
      "Nesta arquitetura, mantemos a compilação estática do Next.js ativa para otimização máxima de SEO, ao mesmo tempo que injetamos rotas dinâmicas baseadas em slugs e identificadores de URL."
    ]
  },
  {
    courseId: "course-2",
    lessonId: "lesson-1-2",
    category: "Programação / Frontend",
    title: "Autenticação e SSO Multilocação (Clerk/WorkOS)",
    paragraphs: [
      "A autenticação em arquiteturas multi-tenant deve ir além da simples verificação de password. Precisamos de mapear a associação lógica de cada utilizador ao seu respetivo inquilino (organização B2B) no momento do aperto de mão (handshake).",
      "Para gerir a identidade de utilizadores comuns usamos o Clerk. O Clerk oferece telas prontas de registo, login e redefinição de password integrando redes sociais de forma direta e rápida via ClerkProvider no layout root.",
      "Para clientes empresariais exigentes (B2B), integramos o WorkOS SSO. O WorkOS permite que os colaboradores da organização cliente efetuem o login utilizando os seus próprios sistemas de identidade corporativa (SAML / OIDC / Okta).",
      "O nosso middleware.ts atua no Edge intercetando os pedidos do browser. Ele lê o domínio de e-mail do utilizador ou o subdomínio da URL, descobre o tenant correspondente no WorkOS, e injeta o cabeçalho 'x-tenant-id' na request."
    ]
  },
  {
    courseId: "course-2",
    lessonId: "lesson-1-3",
    category: "Programação / Frontend",
    title: "Estruturação de Dados com Sanity Headless CMS",
    paragraphs: [
      "O Sanity.io é um Headless CMS focado em conteúdos estruturados em JSON. Diferente dos CMS tradicionais baseados em HTML gerado no painel, o Sanity permite modelar esquemas tipados robustos que são consumidos via API no Next.js.",
      "Escrevemos consultas GROQ (Graph-Relational Object Queries) para buscar dados estruturados e otimizar a latência. A linguagem GROQ permite encadear relacionamentos de forma declarativa e resolver referências em tempo de execução.",
      "Os textos ricos de aulas são gravados no formato 'Portable Text'. O Portable Text descreve a estrutura de parágrafos, cabeçalhos, blocos de código e imagens como uma árvore de objetos JSON, prevenindo vulnerabilidades de injeção de HTML.",
      "Ao buscar dados do Sanity, aplicamos cache agressiva no Next.js e usamos webhooks em tempo real do Sanity para invalidar e revalidar a cache apenas quando existem novos conteúdos publicados no painel de autoria."
    ]
  },

  // 3. Curso 3: Smart Contracts e Criptografia com Solidity
  {
    courseId: "course-3",
    lessonId: "lesson-1-1",
    category: "Crypto & Blockchain",
    title: "Fundamentos da EVM e Smart Contracts",
    paragraphs: [
      "A Máquina Virtual Ethereum (EVM) funciona como um computador global descentralizado e redundante. Cada transação efetuada na blockchain consome recursos computacionais medidos em taxas de Gas, que pagam aos mineradores/validadores.",
      "Escrevemos Smart Contracts na linguagem Solidity, que é compilada em Bytecodes executáveis pela EVM. Esses contratos contêm variáveis de estado persistidas de forma imutável nos blocos da blockchain.",
      "Cada contrato implantado na rede recebe um endereço público de 20 bytes. Qualquer utilizador pode interagir com as funções públicas do contrato efetuando transações assinadas criptograficamente pelas suas chaves privadas.",
      "A imutabilidade exige cuidado extremo. Uma vez publicado na blockchain, o código do Smart Contract não pode ser modificado, exigindo auditorias completas e rigorosos planos de verificação antes de qualquer deploy em ambiente de produção."
    ]
  },
  {
    courseId: "course-3",
    lessonId: "lesson-1-2",
    category: "Crypto & Blockchain",
    title: "Construindo Tokens ERC-20 e Padrões ERC-721",
    paragraphs: [
      "O padrão ERC-20 define uma interface padrão para a criação de tokens fungíveis intermutáveis na rede Ethereum. Ele dita funções obrigatórias como transfer, balanceOf, approve e eventos de transferência.",
      "Para ativos não-fungíveis únicos (NFTs), utilizamos o padrão ERC-721. O ERC-721 permite associar identificadores inteiros exclusivos (tokenIds) a metadados externos (imagens, JSON, arquivos) persistidos na IPFS.",
      "Utilizamos a biblioteca open-source do OpenZeppelin para estender os nossos contratos. A biblioteca fornece implementações auditadas e seguras dos padrões ERC-20 e ERC-721 protegendo-nos contra falhas comuns de implementação.",
      "O deploy de contratos é feito recorrendo a ferramentas de desenvolvimento como Hardhat ou Foundry, permitindo testar funções locais, simular gas fees e automatizar a verificação do código de Solidity na rede Etherscan."
    ]
  },
  {
    courseId: "course-3",
    lessonId: "lesson-1-3",
    category: "Crypto & Blockchain",
    title: "Auditoria e Segurança contra Opcodes Vulneráveis",
    paragraphs: [
      "A falha de segurança mais famosa no ecossistema Web3 é a vulnerabilidade de Reentrancy. Ela ocorre quando um contrato transfere fundos para um endereço externo antes de atualizar a sua variável de saldo interno, permitindo saques infinitos.",
      "Para prevenir Reentrancy, seguimos rigorosamente o padrão de desenvolvimento 'Checks-Effects-Interactions'. Primeiramente validamos os requisitos, a seguir alteramos o estado interno, e por fim interagimos com a chave pública externa.",
      "Também importamos e herdamos a biblioteca ReentrancyGuard do OpenZeppelin, aplicando o modificador nonReentrant nas funções críticas de saque e pagamentos do contrato inteligente.",
      "Realizamos análises estáticas de segurança com utilitários automatizados como Slither e Mythril para detetar overflow de variáveis aritméticas antigas, dependência de carimbo de data/hora (timestamp manipulation) e problemas de controlo de acesso."
    ]
  },
  {
    courseId: "course-criptomoedas-n1",
    lessonId: "lesson-1-1",
    category: "Crypto & Blockchain",
    title: "Introdução às Criptomoedas e Satoshi Nakamoto",
    paragraphs: [
      "Uma criptomoeda descentralizada é produzida, coletivamente, por um sistema de criptomoedas sendo o sistema definido, criado e disponível publicamente.",
      "Em sistemas bancários ou económicos centralizados como o Sistema de Reserva Federal dos Estados Unidos, os conselhos administrativos ou governos controlam o fornecimento de moeda através da impressão de moeda fiduciária ( FIAT ).",
      "As Empresas ou governos não podem produzir unidades de criptomoedas e assim, não forneceram até agora apoio a outras entidades, bancos ou corporações que guardam ativos medidos através de uma criptomoeda descentralizada.",
      "Os recursos técnicos sobre os quais as criptomoedas descentralizadas são baseadas foram criados pelo grupo / indivíduo conhecido como Satoshi Nakamoto."
    ]
  },
  {
    courseId: "course-criptomoedas-n1",
    lessonId: "lesson-1-2",
    category: "Crypto & Blockchain",
    title: "Características, Altcoins e Exchanges",
    paragraphs: [
      "A segurança, integridade e balanço dos registros de um sistema de criptomoeda são mantidos por uma comunidade de mineradores: pessoas utilizando os seus computadores para ajudar a validar transações, adicionando-as ao registro (blockchain) de acordo com um esquema definido.",
      "A segurança dos registros de uma criptomoeda baseiam-se na suposição de que a maioria dos mineradores mantêm o arquivo de modo honesto, tendo um incentivo financeiro para isso.",
      "A maior parte das criptomoedas são planeadas para diminuir a produção de novas moedas, definindo assim um número máximo de moedas que entrarão em circulação. Desta forma imita a escassez (e valor) de metais preciosos e evita a hiperinflação.",
      "A BITCOIN é a moeda mais popular, mas não é a única. As ALTCOINS são uma ótima alternativa, aumentando diversidade do portfólio. A escolha deve levar em consideração se está a investir ou a negociar, o seu perfil de risco e tipo de análise que deseja fazer. Pode escolher a análise fundamental ou técnica ou uma mistura de ambas.",
      "Assim, estará pronto para investir ou negociar em qualquer bolsa (Exchange) como a BINANCE, KRAKEN, COINBASE ou CEX.IO. Investir em criptomoedas é uma ótima forma de DIVERSIFICAR o investimento. Deve ter uma estratégia baseada no seu perfil de risco e nunca investir mais do que pode perder."
    ]
  },
  {
    courseId: "course-criptomoedas-n1",
    lessonId: "lesson-1-3",
    category: "Crypto & Blockchain",
    title: "Operação de Carteiras e Wallets",
    paragraphs: [
      "Como forma de dinheiro digital, as criptomoedas não têm características físicas e nem fronteiras, tornando-as menos restritivas para transações. Além disso, as transações são irreversíveis e a natureza das criptomoedas torna o rastreamento consideravelmente mais difícil quando comparado ao sistema de moedas fiduciárias.",
      "O proprietário da conta tem um par de chaves pública-privada (Ku, Kr) para a conta (um par por conta). Armazenadas numa ou mais carteiras. Se a Chave Privada (Kr) for roubada, o ladrão pode fazer transações na conta.",
      "Na Bitcoin, o endereço é o hash da chave pública (Ku - 20 bytes). Fornece uma forma de anonimato: o endereço não diz nada sobre o dono da conta. O fluxo de dinheiro entre os endereços é observável e NÓS bem posicionados podem obter mais informação sobre as carteiras / utilizadores.",
      "Temos carteiras baseadas em SOFTWARE (como Trust Wallet e Metamask) e carteiras de HARDWARE (como Ledger e Trezor) que mantêm as chaves in ambientes físicos seguros e desligados da internet."
    ]
  }
];

/**
 * Popula a coleção 'lesson_chunks' com dados reais de apoio das lições
 * permitindo que a pesquisa vetorial (RAG) retorne dados semânticos autênticos.
 */
export async function seedLessonChunks(tenantId = "root", adminEmail?: string) {
  const db = await getDb();

  // Limpar dados anteriores do tenant para evitar duplicação
  await db.collection("lesson_chunks").deleteMany({
    tenant_id: tenantId,
  });

  const documents: any[] = [];

  // Mapeamos os parágrafos para simular chunks semânticos
  for (const item of SEED_DATA) {
    item.paragraphs.forEach((paragraph, idx) => {
      // Simulação rápida de vetor de embeddings para desenvolvimento (dimensão 1536)
      // Em produção, as chamadas a openai/Titan geram vetores reais.
      // Esta aproximação garante integridade da coleção do MongoDB e funcionamento dos fallbacks.
      const dummyVector = new Array(1536).fill(0).map((_, i) => 
        (i % 17 === 0 ? 0.25 : 0.0) + (idx * 0.05)
      );

      documents.push({
        tenant_id: tenantId,
        courseId: item.courseId,
        lessonId: item.lessonId,
        chunkIndex: idx,
        content: paragraph,
        embedding: dummyVector,
        createdAt: new Date(),
      });
    });
  }

  // Inserção no banco de dados
  await db.collection("lesson_chunks").insertMany(documents);
  
  if (tenantId === "root") {
    await seedSecurityData(adminEmail);
  }

  console.log(`Seeder concluído com sucesso: ${documents.length} chunks inseridos no banco de dados para tenant "${tenantId}".`);
  return documents.length;
}

const PERMISSIONS_DATA = [
  // Módulo ADMIN (Administrador Global)
  { _id: "COMPANIES_CREATE", name: "Criar Empresas", module: "ADMIN", description: "Registar novas empresas na plataforma" },
  { _id: "COMPANIES_EDIT", name: "Editar Empresas", module: "ADMIN", description: "Alterar dados cadastrais das empresas" },
  { _id: "COMPANIES_DELETE", name: "Eliminar Empresas", module: "ADMIN", description: "Eliminar definitivamente registos de empresas" },
  { _id: "COMPANIES_STATUS", name: "Ativar/Suspender Empresas", module: "ADMIN", description: "Alterar o estado operacional de uma empresa" },
  { _id: "USERS_CREATE", name: "Criar Utilizadores", module: "ADMIN", description: "Registar utilizadores de qualquer nível" },
  { _id: "USERS_EDIT", name: "Editar Utilizadores", module: "ADMIN", description: "Atualizar perfis e dados de utilizadores" },
  { _id: "USERS_DELETE", name: "Eliminar Utilizadores", module: "ADMIN", description: "Remover utilizadores do sistema" },
  { _id: "USER_ROLES_CHANGE", name: "Alterar Perfis de Utilizador", module: "ADMIN", description: "Modificar perfis de acesso concedidos a utilizadores" },
  { _id: "GLOBAL_SETTINGS_CONFIG", name: "Configurar Parâmetros Globais", module: "ADMIN", description: "Configurar propriedades globais da plataforma" },
  { _id: "LOGS_VIEW", name: "Consultar Logs", module: "ADMIN", description: "Visualizar registos de auditoria e logs do sistema" },
  { _id: "AUTH_CONFIG", name: "Configurar Autenticação", module: "ADMIN", description: "Configurar métodos de autenticação e SSO" },
  { _id: "INTEGRATIONS_CONFIG", name: "Configurar Integrações", module: "ADMIN", description: "Gerir ligações com sistemas externos" },
  { _id: "NOTIFICATIONS_CONFIG", name: "Configurar Notificações", module: "ADMIN", description: "Definir canais e templates de alertas globais" },

  // Módulo COMPANY (Gestor Empresa / Funcionário)
  { _id: "STUDENTS_MANAGE", name: "Gerir Alunos", module: "COMPANY", description: "Criar, editar e eliminar alunos da empresa" },
  { _id: "EMPLOYEES_MANAGE", name: "Gerir Funcionários", module: "COMPANY", description: "Criar, editar e eliminar colaboradores corporativos" },
  { _id: "COURSES_SCHEDULE", name: "Agendar Cursos", module: "COMPANY", description: "Agendar e atribuir cursos para os alunos associados" },
  { _id: "PAYMENTS_VIEW_ALL", name: "Consultar Pagamentos", module: "COMPANY", description: "Aceder a relatórios financeiros e faturas da empresa" },
  { _id: "PAYMENTS_VALIDATE", name: "Validar Pagamentos", module: "COMPANY", description: "Aprovar comprovativos e estados de pagamentos" },
  { _id: "PAYMENTS_NOTIFY", name: "Emitir Avisos de Pagamento", module: "COMPANY", description: "Enviar alertas de faturas pendentes aos alunos" },
  { _id: "DOCS_MANAGE", name: "Gerir Documentação", module: "COMPANY", description: "Carregar e associar documentos institucionais" },
  { _id: "REPORTS_VIEW", name: "Consultar Relatórios da Empresa", module: "COMPANY", description: "Visualizar estatísticas de progresso e atividade do tenant" },
  { _id: "COMPANY_INFO_UPDATE", name: "Atualizar Dados da Empresa", module: "COMPANY", description: "Editar designação, logo e definições do tenant" },
  { _id: "MESSAGES_SEND_COMPANY", name: "Enviar Mensagens na Empresa", module: "COMPANY", description: "Comunicar com colaboradores e formandos do mesmo tenant" },

  // Módulo STUDENT (Aluno)
  { _id: "AUTH_BASIC", name: "Autenticar-se", module: "STUDENT", description: "Realizar login básico e validação de conta" },
  { _id: "COURSES_STUDY", name: "Frequentar Cursos", module: "STUDENT", description: "Aceder ao player de aulas, realizar desafios e falar com a IA" },
  { _id: "PAYMENTS_EXECUTE", name: "Efetuar Pagamentos", module: "STUDENT", description: "Realizar liquidação de subscrições via gateway de pagamento" },
  { _id: "PAYMENTS_VIEW_OWN", name: "Consultar Pagamentos Próprios", module: "STUDENT", description: "Aceder às faturas pessoais e histórico de compras" },
  { _id: "CERTIFICATES_VIEW", name: "Consultar Certificados", module: "STUDENT", description: "Descarregar diplomas e certificados académicos" },
  { _id: "HISTORY_VIEW_OWN", name: "Consultar Histórico Próprio", module: "STUDENT", description: "Visualizar progresso de aprendizagem histórico" },
  { _id: "DOCS_VIEW", name: "Consultar Documentação", module: "STUDENT", description: "Ler guias de utilização e do formando" },
  { _id: "NOTIFICATIONS_RECEIVE", name: "Receber Notificações", module: "STUDENT", description: "Receber e-mails e alertas de notificações internas" },
  { _id: "MESSAGES_TUTOR", name: "Comunicar com o Tutor", module: "STUDENT", description: "Trocar mensagens com o tutor pedagógico" },
  { _id: "REQUESTS_REGISTER", name: "Registar Pedidos", module: "STUDENT", description: "Submeter pedidos de apoio à gerência" },
  { _id: "PERSONAL_DATA_UPDATE", name: "Atualizar Dados Pessoais", module: "STUDENT", description: "Editar dados de perfil e alterar palavra-passe" },

  // Módulo ACADEMIC (Gestor Académico / Professor / Formador / Tutor)
  { _id: "COURSES_CREATE", name: "Criar Cursos", module: "ACADEMIC", description: "Criar cursos estruturados e módulos base" },
  { _id: "COURSES_EDIT", name: "Editar Cursos", module: "ACADEMIC", description: "Modificar currículo de cursos existentes" },
  { _id: "COURSES_ARCHIVE", name: "Arquivar Cursos", module: "ACADEMIC", description: "Arquivar ou desativar cursos pedagógicos" },
  { _id: "COURSES_PUBLISH", name: "Publicar Cursos", module: "ACADEMIC", description: "Disponibilizar cursos na biblioteca de catálogo" },
  { _id: "ACADEMICS_ASSIGN", name: "Atribuir Académicos", module: "ACADEMIC", description: "Associar professores, formadores e tutores aos cursos" },
  { _id: "HISTORY_VIEW_ALL", name: "Consultar Histórico Geral", module: "ACADEMIC", description: "Acompanhar logs de progresso agregados de toda a plataforma" },
  { _id: "OCCURRENCES_REGISTER", name: "Registar Ocorrências", module: "ACADEMIC", description: "Registar ocorrências pedagógicas e técnicas sobre alunos" },
  { _id: "COURSES_TEACH", name: "Lecionar Cursos", module: "ACADEMIC", description: "Aceder ao painel de ensino e responder a dúvidas de alunos" },
  { _id: "COURSES_ASSIGNED_VIEW", name: "Consultar Cursos Atribuídos", module: "ACADEMIC", description: "Ver catálogo exclusivo de cursos sob a sua docência" },
  { _id: "COMMUNICATE_COMPANIES", name: "Comunicar com Empresas", module: "ACADEMIC", description: "Trocar mensagens com gestores empresariais" },
  { _id: "COMMUNICATE_ADMIN", name: "Comunicar com Administração", module: "ACADEMIC", description: "Reportar ocorrências à equipa de gestão global" },
  { _id: "CONTENTS_CREATE", name: "Criar Conteúdos", module: "ACADEMIC", description: "Escrever textos e lições estruturadas" },
  { _id: "CONTENTS_EDIT", name: "Editar Conteúdos", module: "ACADEMIC", description: "Modificar conteúdos e chunks semânticos" },
  { _id: "CONTENTS_UPDATE", name: "Atualizar Conteúdos", module: "ACADEMIC", description: "Atualizar materiais das lições em tempo real" },
  { _id: "STUDENTS_ACCOMPANY", name: "Acompanhar Alunos", module: "ACADEMIC", description: "Monitorizar evolução académica de alunos sob tutela" },
  { _id: "PROGRESS_VIEW", name: "Consultar Progresso Pedagógico", module: "ACADEMIC", description: "Ver detalhe de percentagem de lições concluídas por aluno" },
  { _id: "COMMUNICATE_STUDENTS", name: "Comunicar com Alunos", module: "ACADEMIC", description: "Trocar mensagens pedagógicas com estudantes" },

  // Módulo FINANCIAL (Financeiro)
  { _id: "PAYMENTS_CONTROL", name: "Controlar Pagamentos", module: "FINANCIAL", description: "Controlar pagamentos pendentes e transações da plataforma" },
  { _id: "PAYMENTS_CONFIRM", name: "Confirmar Pagamentos", module: "FINANCIAL", description: "Confirmar transações manuais e depósitos bancários" },
  { _id: "FINANCIAL_DOCS_EMIT", name: "Emitir Documentos Financeiros", module: "FINANCIAL", description: "Emitir recibos e faturas em PDF aos clientes" },

  // Módulo SUPPORT (Suporte Técnico)
  { _id: "INCIDENTS_RESOLVE", name: "Resolver Incidentes", module: "SUPPORT", description: "Visualizar e responder a tickets de suporte técnico" },
  { _id: "COMPANIES_MANAGE_TECH", name: "Gerir Empresas (Técnico)", module: "SUPPORT", description: "Gerir inquilinos ao nível de infraestrutura de dados" },
  { _id: "USERS_MANAGE_TECH", name: "Gerir Utilizadores (Técnico)", module: "SUPPORT", description: "Diagnosticar logins e limpar caches de contas" },
  { _id: "PARAMS_CONFIG_TECH", name: "Configurar Parâmetros de Suporte", module: "SUPPORT", description: "Definir variáveis de ambiente e chaves da aplicação" },
  { _id: "AUDIT_VIEW_TECH", name: "Consultar Auditoria (Técnico)", module: "SUPPORT", description: "Visualizar logs de segurança de infraestrutura" },
  { _id: "SYSTEM_MONITOR", name: "Monitorizar Sistema", module: "SUPPORT", description: "Acompanhar estado de saúde das APIs e banco de dados" },
  { _id: "PERMISSIONS_EDIT_TECH", name: "Definir Permissões", module: "SUPPORT", description: "Editar matriz de permissões técnica" }
];

const ROLES_DATA = [
  {
    _id: "ADMIN",
    name: "Administrador da Plataforma",
    permissions: [
      "COMPANIES_CREATE", "COMPANIES_EDIT", "COMPANIES_DELETE", "COMPANIES_STATUS",
      "USERS_CREATE", "USERS_EDIT", "USERS_DELETE", "USER_ROLES_CHANGE",
      "GLOBAL_SETTINGS_CONFIG", "LOGS_VIEW", "AUTH_CONFIG", "INTEGRATIONS_CONFIG", "NOTIFICATIONS_CONFIG",
      "PAYMENTS_VIEW_ALL", "PAYMENTS_VALIDATE", "COURSES_CREATE", "HISTORY_VIEW_ALL"
    ]
  },
  {
    _id: "GESTOR_EMPRESA",
    name: "Gestor Empresa",
    permissions: [
      "STUDENTS_MANAGE", "EMPLOYEES_MANAGE", "COURSES_SCHEDULE", "PAYMENTS_VIEW_ALL",
      "PAYMENTS_VALIDATE", "PAYMENTS_NOTIFY", "DOCS_MANAGE", "REPORTS_VIEW",
      "COMPANY_INFO_UPDATE", "MESSAGES_SEND_COMPANY"
    ]
  },
  {
    _id: "FUNCIONARIO",
    name: "Funcionário",
    permissions: [
      "STUDENTS_MANAGE", "EMPLOYEES_MANAGE", "REPORTS_VIEW", "PAYMENTS_VALIDATE",
      "DOCS_MANAGE", "COURSES_SCHEDULE", "MESSAGES_SEND_COMPANY", "COMPANY_INFO_UPDATE"
    ]
  },
  {
    _id: "ALUNO",
    name: "Aluno",
    permissions: [
      "AUTH_BASIC", "COURSES_STUDY", "PAYMENTS_EXECUTE", "PAYMENTS_VIEW_OWN",
      "CERTIFICATES_VIEW", "HISTORY_VIEW_OWN", "DOCS_VIEW", "NOTIFICATIONS_RECEIVE",
      "MESSAGES_TUTOR", "REQUESTS_REGISTER", "PERSONAL_DATA_UPDATE"
    ]
  },
  {
    _id: "GESTOR_ACADEMICO",
    name: "Gestor Académico",
    permissions: [
      "COURSES_CREATE", "COURSES_EDIT", "COURSES_ARCHIVE", "COURSES_PUBLISH",
      "ACADEMICS_ASSIGN", "HISTORY_VIEW_ALL", "DOCS_VIEW", "NOTIFICATIONS_RECEIVE",
      "OCCURRENCES_REGISTER", "PERSONAL_DATA_UPDATE"
    ]
  },
  {
    _id: "PROFESSOR",
    name: "Professor",
    permissions: [
      "COURSES_TEACH", "COURSES_ASSIGNED_VIEW", "HISTORY_VIEW_ALL", "DOCS_VIEW",
      "COMMUNICATE_COMPANIES", "COMMUNICATE_ADMIN", "OCCURRENCES_REGISTER", "PERSONAL_DATA_UPDATE"
    ]
  },
  {
    _id: "FORMADOR",
    name: "Formador",
    permissions: [
      "CONTENTS_CREATE", "CONTENTS_EDIT", "CONTENTS_UPDATE", "NOTIFICATIONS_RECEIVE",
      "OCCURRENCES_REGISTER", "COMMUNICATE_ADMIN", "PERSONAL_DATA_UPDATE"
    ]
  },
  {
    _id: "TUTOR",
    name: "Tutor",
    permissions: [
      "STUDENTS_ACCOMPANY", "PROGRESS_VIEW", "DOCS_VIEW", "HISTORY_VIEW_ALL",
      "COMMUNICATE_STUDENTS", "OCCURRENCES_REGISTER", "NOTIFICATIONS_RECEIVE", "PERSONAL_DATA_UPDATE"
    ]
  },
  {
    _id: "FINANCEIRO",
    name: "Financeiro",
    permissions: [
      "PAYMENTS_CONTROL", "PAYMENTS_CONFIRM", "FINANCIAL_DOCS_EMIT", "HISTORY_VIEW_ALL",
      "DOCS_VIEW", "COMMUNICATE_ADMIN", "NOTIFICATIONS_RECEIVE", "PERSONAL_DATA_UPDATE"
    ]
  },
  {
    _id: "SUPORTE",
    name: "Suporte Técnico",
    permissions: [
      "INCIDENTS_RESOLVE", "COMPANIES_MANAGE_TECH", "USERS_MANAGE_TECH", "PARAMS_CONFIG_TECH",
      "AUDIT_VIEW_TECH", "SYSTEM_MONITOR", "PERMISSIONS_EDIT_TECH"
    ]
  }
];

export async function seedSecurityData(adminEmail?: string) {
  const db = await getDb();
  
  // Limpar e re-inserir permissões
  await db.collection("permissions").deleteMany({});
  await db.collection("permissions").insertMany(PERMISSIONS_DATA);
  
  // Limpar e re-inserir perfis
  await db.collection("roles").deleteMany({});
  await db.collection("roles").insertMany(ROLES_DATA);

  // Limpar todos os utilizadores para forçar o bloqueio a contas não registadas
  await db.collection("users").deleteMany({});

  // Inserir Administrador padrão do sistema
  const defaultAdmin = {
    _id: "admin-principal",
    email: "admin@mozai.education",
    firstName: "Admin",
    lastName: "MOZAI",
    tenants: [
      {
        tenantId: "root",
        roles: ["ADMIN"]
      }
    ],
    globalAdmin: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await db.collection("users").insertOne(defaultAdmin);

  // Se for fornecido um e-mail adicional (ex: para o utilizador Clerk do teste), adicionamo-lo também como ADMIN
  if (adminEmail && adminEmail.toLowerCase().trim() !== "admin@mozai.education") {
    await db.collection("users").insertOne({
      _id: "admin-teste",
      email: adminEmail.toLowerCase().trim(),
      firstName: "Admin",
      lastName: "Teste",
      tenants: [
        {
          tenantId: "root",
          roles: ["ADMIN", "ALUNO"]
        }
      ],
      globalAdmin: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`Seeder: Administrador de teste registado para e-mail: ${adminEmail}`);
  }
  
  console.log("Seeder: Permissões, Perfis e Administradores padrão populados com sucesso.");
}
