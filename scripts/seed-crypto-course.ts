import "./load-env";
import { createClient } from "next-sanity";

/**
 * SEED: Cria o curso "Criptomoedas — Fundamentos Nível I" no Sanity CMS
 * a partir do conteúdo do PDF oficial do formador.
 *
 * Executar:  npx tsx scripts/seed-crypto-course.ts
 *
 * Requer no .env.local:
 *   SANITY_PROJECT_ID (ou NEXT_PUBLIC_SANITY_PROJECT_ID)
 *   SANITY_API_WRITE_TOKEN   <-- token com permissão de Editor/Write
 */

const projectId =
  process.env.SANITY_PROJECT_ID || process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset =
  process.env.SANITY_DATASET || process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
const token = process.env.SANITY_API_WRITE_TOKEN;

if (!projectId || projectId === "dummy-project-id") {
  console.error("❌ Falta SANITY_PROJECT_ID no .env.local");
  process.exit(1);
}
if (!token) {
  console.error("❌ Falta SANITY_API_WRITE_TOKEN (token de escrita) no .env.local");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: "2023-05-03",
  token,
  useCdn: false,
});

// --- Helpers para construir Portable Text -----------------------------------

let keyCounter = 0;
const k = () => `k${keyCounter++}`;

/** Parágrafo simples de texto. */
function p(text: string) {
  return {
    _type: "block",
    _key: k(),
    style: "normal",
    markDefs: [],
    children: [{ _type: "span", _key: k(), text, marks: [] }],
  };
}

/** Cabeçalho H2. */
function h2(text: string) {
  return {
    _type: "block",
    _key: k(),
    style: "h2",
    markDefs: [],
    children: [{ _type: "span", _key: k(), text, marks: [] }],
  };
}

/** Item de lista com marcadores. */
function bullet(text: string) {
  return {
    _type: "block",
    _key: k(),
    style: "normal",
    listItem: "bullet",
    level: 1,
    markDefs: [],
    children: [{ _type: "span", _key: k(), text, marks: [] }],
  };
}

// --- Definição do conteúdo (do PDF Nível I) ---------------------------------

interface LessonDef {
  id: string;
  title: string;
  duration: number;
  isFree?: boolean;
  content: any[];
  exercises?: {
    question: string;
    options: string[];
    correctIndex: number;
  }[];
}

interface ModuleDef {
  id: string;
  title: string;
  order: number;
  lessons: LessonDef[];
}

const modules: ModuleDef[] = [
  {
    id: "crypto-n1-mod-intro",
    title: "Introdução e Definição de Criptomoeda",
    order: 1,
    lessons: [
      {
        id: "crypto-n1-l-intro",
        title: "Introdução às Criptomoedas",
        duration: 12,
        isFree: true,
        content: [
          h2("O que é uma criptomoeda descentralizada"),
          p(
            "Uma criptomoeda descentralizada é produzida, coletivamente, por um sistema de criptomoedas, sendo o sistema definido, criado e disponível publicamente."
          ),
          p(
            "Em sistemas bancários ou económicos centralizados como o Sistema de Reserva Federal dos Estados Unidos, os conselhos administrativos ou governos controlam o fornecimento de moeda através da impressão de moeda fiduciária (FIAT)."
          ),
          p(
            "As empresas ou governos não podem produzir unidades de criptomoedas. Os recursos técnicos sobre os quais as criptomoedas descentralizadas são baseadas foram criados pelo grupo/indivíduo conhecido como Satoshi Nakamoto."
          ),
          p(
            "A segurança, integridade e balanço dos registos são mantidos por uma comunidade de mineradores: pessoas que usam os seus computadores para validar transações, adicionando-as ao registo (blockchain) de acordo com um esquema definido. A maior parte das criptomoedas são planeadas para diminuir a produção de novas moedas, definindo um número máximo de moedas em circulação — imitando a escassez dos metais preciosos e evitando a hiperinflação."
          ),
          p(
            "A Bitcoin é a moeda mais popular, mas não é a única. As Altcoins são uma alternativa que aumenta a diversidade do portfólio. A escolha deve considerar se está a investir ou a negociar, o seu perfil de risco e o tipo de análise (fundamental, técnica ou uma mistura). Nunca investir mais do que se pode perder."
          ),
        ],
        exercises: [
          {
            question: "Quem é atribuída a criação dos recursos técnicos das criptomoedas descentralizadas?",
            options: ["Satoshi Nakamoto", "Vitalik Buterin", "A Reserva Federal", "O FMI"],
            correctIndex: 0,
          },
        ],
      },
      {
        id: "crypto-n1-l-definicao",
        title: "Definição Formal de Criptomoeda",
        duration: 10,
        content: [
          h2("As seis condições de um sistema de criptomoeda"),
          bullet("Não requer autoridade central, é distribuído."),
          bullet("Tem a visão geral das unidades de criptomoeda e sua propriedade."),
          bullet("Define se podem ser criadas novas criptomoedas."),
          bullet("Se podem ser criadas, define circunstâncias da origem e propriedade dessas novas unidades."),
          bullet("Propriedade da criptomoeda provada exclusivamente por criptografia."),
          bullet("Permite executar transações que alteram a propriedade; um extrato de transação só pode ser emitido por uma entidade que comprove a propriedade atual das unidades."),
          bullet("Se duas instruções para alterar a propriedade das mesmas unidades forem inseridas simultaneamente, o sistema executa no máximo uma delas."),
          p(
            "Investir em criptomoedas é uma forma de diversificar o investimento, mas exige entender conceitos e princípios básicos, pesquisa e análise cuidadosas, e uma estratégia baseada no perfil de risco."
          ),
        ],
      },
    ],
  },
  {
    id: "crypto-n1-mod-origem",
    title: "Origem das Criptomoedas — Bitcoin e Ethereum",
    order: 2,
    lessons: [
      {
        id: "crypto-n1-l-origem",
        title: "A Origem das Criptomoedas",
        duration: 10,
        content: [
          p(
            "Uma criptomoeda ou cibermoeda é um meio de troca, podendo ser centralizado ou descentralizado, que usa tecnologia de blockchain e criptografia para assegurar a validade das transações e a criação de novas unidades da moeda."
          ),
          p(
            "A Bitcoin foi a primeira criptomoeda descentralizada, criada em 2009 por Satoshi Nakamoto — personalidade misteriosa cuja identidade se desconhece."
          ),
          p(
            "Desde então surgiram muitas outras: ETH, LTC, ADA, BNB, DASH, VET, FIL, MATIC, MKR, DOGE, DUSK, entre outras. Recentemente assistiu-se à explosão de tokens criados sobre o protocolo Ethereum, sobretudo após a onda de ICOs (Initial Coin Offerings) de 2017."
          ),
        ],
      },
      {
        id: "crypto-n1-l-buzz-bitcoin",
        title: "O Buzz à Volta do Bitcoin",
        duration: 12,
        content: [
          p(
            "Desde a primeira transação de Bitcoin registada em 2008, a criptomoeda provou ser um dos investimentos mais notáveis. Exceto em 2014, quando o preço caiu para 30 USD num curto período, a Bitcoin continuou a exceder expectativas."
          ),
          p(
            "Em 2015 teve um aumento de +20%. Em 2016 o ganho disparou 120%, passando de 400 USD para 1.200 USD por Bitcoin. Seguiu-se um aumento meteórico para 19.000 USD em 2017, antes de voltar a ~3.000 USD em 2018 e 2019. É a moeda digital de maior capitalização de mercado (market cap)."
          ),
        ],
      },
      {
        id: "crypto-n1-l-como-funciona-bitcoin",
        title: "Como Funciona a Bitcoin e as suas Características",
        duration: 14,
        content: [
          p(
            "Um blockchain é um livro-razão (ledger) que mantém o registo de transações digitais. Em vez de um administrador central, organiza os dados em lotes chamados blocos, ligados por validação criptográfica: cada bloco referencia o anterior por um valor hash, formando uma cadeia ininterrupta. Resolve dois problemas: controlar a informação e evitar a duplicação."
          ),
          p(
            "Computadores por todo o mundo competem para confirmar a operação resolvendo equações matemáticas complexas. O primeiro a validar o bloco recebe uma recompensa em Bitcoins — processo chamado mineração. O bloco validado recebe carimbo de data/hora e é adicionado à cadeia por ordem cronológica."
          ),
          h2("Características da Bitcoin"),
          bullet("Global: sem limites; disponível 24/7/365."),
          bullet("Irreversível: uma transação não pode ser revertida pelo remetente."),
          bullet("Taxas baixas: independentemente do tamanho da transação."),
          bullet("Privada: não exige informação pessoal, apenas o endereço e a quantia."),
          bullet("Segura: a rede é criptográfica; não envia informação sensível."),
          bullet("Aberta: as transações são públicas e não podem ser manipuladas."),
        ],
      },
      {
        id: "crypto-n1-l-ethereum",
        title: "O que é o Ethereum e Bitcoin vs. Ether",
        duration: 14,
        content: [
          p(
            "O Ethereum foi mencionado pela primeira vez em 2013 por Vitalik Buterin, programador russo, num white paper, e lançado em 2015. Ao contrário do Bitcoin, o seu objetivo principal não é agir como moeda, mas permitir 'Contratos Inteligentes' entre partes sem intermediário."
          ),
          p(
            "Contratos inteligentes são códigos de computador que facilitam a troca de dinheiro, propriedade ou qualquer coisa de valor. Como são executados no blockchain, correm exatamente como planeados, sem inatividade, censura ou fraude. O Ethereum permite construir aplicações descentralizadas (DApps) e pode ser visto como o primeiro supercomputador virtual descentralizado do mundo."
          ),
          p(
            "Na blockchain Bitcoin os mineiros trabalham por bitcoins; no Ethereum recebem Ether (ETH), o ativo que abastece a rede e paga taxas de serviços. Bitcoin e Ethereum têm finalidades diferentes e são protocolos separados — não se pode completar uma transação de um para o outro."
          ),
        ],
        exercises: [
          {
            question: "Qual é o objetivo principal do Ethereum, ao contrário do Bitcoin?",
            options: [
              "Permitir contratos inteligentes e aplicações descentralizadas",
              "Substituir totalmente o dinheiro físico",
              "Servir apenas como reserva de valor",
              "Eliminar a mineração",
            ],
            correctIndex: 0,
          },
        ],
      },
    ],
  },
  {
    id: "crypto-n1-mod-moeda",
    title: "A Moeda — Fiat vs. Criptomoedas",
    order: 3,
    lessons: [
      {
        id: "crypto-n1-l-moeda",
        title: "A Moeda e a Moeda Fiduciária (FIAT)",
        duration: 12,
        content: [
          p(
            "Moeda é uma forma de dinheiro normalmente emitida por autoridades públicas. Tem três funções: unidade de conta, reserva de valor e meio de troca. O que a sustenta é o facto de empresas e lares a aceitarem para pagamento de dívidas."
          ),
          p(
            "Moedas fiduciárias (Fiat Currency) são aquelas cujo valor é garantido pelo governo emissor, e não por um bem físico ou commodity. Substituíram o padrão-ouro. Em 1933 o governo dos EUA acabou com a troca de papel por ouro e, em 1971/72, sob Nixon, abandonou completamente o padrão-ouro."
          ),
          p(
            "No padrão-ouro, o dinheiro em papel era conversível numa quantidade finita de ouro, limitando a criação de moeda. No sistema fiduciário, o dinheiro não é conversível, mas os governos e bancos centrais têm mais flexibilidade para responder a crises (reservas fracionárias, flexibilização quantitativa)."
          ),
        ],
      },
      {
        id: "crypto-n1-l-fiat-vs-cripto",
        title: "Moedas Fiduciárias vs. Criptomoedas",
        duration: 12,
        content: [
          p(
            "Fiat e criptomoedas partilham o facto de nenhuma ser respaldada por um commodity físico — mas é aí que a semelhança termina. A fiat é controlada por governos e bancos centrais; as criptomoedas são descentralizadas graças a um livro digital distribuído (Blockchain)."
          ),
          p(
            "O Bitcoin, como a maioria das criptomoedas, tem fornecimento controlado e limitado, ao contrário da fiat que os bancos podem criar a partir do nada. As criptomoedas não têm fronteiras nem características físicas, as transações são irreversíveis e o rastreamento é mais difícil. O mercado é menor e, por isso, mais volátil."
          ),
          p(
            "O Bitcoin não foi criado para substituir todo o sistema fiduciário, mas para oferecer uma rede económica alternativa, construída numa rede ponto-a-ponto (P2P) totalmente distribuída, com potencial de criar um sistema financeiro melhor."
          ),
        ],
      },
    ],
  },
  {
    id: "crypto-n1-mod-blockchain",
    title: "Blockchain",
    order: 4,
    lessons: [
      {
        id: "crypto-n1-l-blockchain",
        title: "Blockchain — O que é e como funciona",
        duration: 12,
        content: [
          p(
            "A validade das moedas de cada criptomoeda é fornecida por uma blockchain: uma lista crescente de registos (blocos) vinculados e protegidos com criptografia. Cada bloco contém um ponteiro de hash para o bloco anterior, um registo de data/hora e dados de transação."
          ),
          p(
            "Por design, as blockchains resistem à modificação dos dados — 'um livro aberto e distribuído que regista transações entre duas partes de maneira eficiente, verificável e permanente'. Uma vez registados, os dados de um bloco não podem ser alterados retroativamente sem alterar todos os blocos subsequentes, o que exigiria o conluio da maioria da rede."
          ),
          p(
            "As blockchains são seguras por design e toleram falhas bizantinas. O consenso descentralizado resolve o problema do gasto duplo sem uma autoridade confiável. O 'tempo de bloqueio' é o tempo médio para gerar um bloco novo; um tempo de bloqueio mais curto significa transações mais rápidas."
          ),
        ],
        exercises: [
          {
            question: "Porque é que os dados de um bloco não podem ser alterados retroativamente com facilidade?",
            options: [
              "Exigiria alterar todos os blocos subsequentes e o conluio da maioria da rede",
              "Porque estão encriptados com uma palavra-passe do governo",
              "Porque são apagados após 5 segundos",
              "Porque só o Satoshi Nakamoto tem a chave",
            ],
            correctIndex: 0,
          },
        ],
      },
    ],
  },
  {
    id: "crypto-n1-mod-diferentes",
    title: "Diferentes Criptomoedas",
    order: 5,
    lessons: [
      {
        id: "crypto-n1-l-btc-altcoins",
        title: "Bitcoin ou Altcoins?",
        duration: 12,
        content: [
          p(
            "A Bitcoin é normalmente a primeira moeda onde investir, para os iniciantes: é o projeto de blockchain mais famoso e a maior criptomoeda por capitalização de mercado. No entanto, existem milhares de criptomoedas (altcoins). Algumas têm o próprio blockchain, outras usam uma rede pré-existente (como Binance Smart Chain ou Ethereum)."
          ),
          p(
            "A diversificação de ativos remove o risco de investir apenas num só projeto — se um falhar, perde-se menos. Mas investir em altcoins pode ser arriscado e existem muitos golpes (scams)."
          ),
          p(
            "ALERTA IMPORTANTE: se não conhecer a entidade/pessoa, NUNCA lhe envie criptomoedas — mesmo que lhe digam 'envia-me 2 moedas e depois dou-te 4'. É uma burla típica. Faça sempre a sua própria pesquisa (DYOR) antes de correr riscos."
          ),
          p(
            "O termo altcoin refere-se a qualquer criptomoeda diferente do bitcoin — 'moedas digitais alternativas' ou 'versões alternativas do bitcoin'."
          ),
        ],
        exercises: [
          {
            question: "Se alguém desconhecido lhe diz 'envia 2 moedas e devolvo 4', o que deve fazer?",
            options: [
              "Nunca enviar — é uma burla típica",
              "Enviar rapidamente para não perder a oportunidade",
              "Enviar só 1 moeda para testar",
              "Pedir para enviarem 8 em vez de 4",
            ],
            correctIndex: 0,
          },
        ],
      },
      {
        id: "crypto-n1-l-stablecoins",
        title: "Stablecoins / Moedas Estáveis",
        duration: 12,
        content: [
          p(
            "A Bitcoin e as Altcoins oscilam muito. As STABLECOINS são criptomoedas projetadas para estabilidade de preços, com uma referência (PEG) a moeda fiduciária (USD, Euro), commodity (ouro) ou um pacote de ativos. A garantia (collateral) assegura que a moeda em circulação tem valor de resgate."
          ),
          p(
            "Mecanismos de ajuste ao PEG: reserva do ativo de referência (resgate para corrigir o preço); moeda dupla (uma segunda moeda absorve as oscilações); algorítmico (o saldo ajusta-se automaticamente); e empréstimos de alavancagem (combinação dos anteriores)."
          ),
          p(
            "Caso de estudo — TETHER (USDT): stablecoin com referência a moeda FIAT (USD, Euro, Iene), inicialmente com garantia a 100% da moeda em circulação. Não é totalmente descentralizada (gerida pela Tether Limited). Teve problemas de confiança: em 14/3/2019 alterou a política de apoio para incluir empréstimos a empresas afiliadas, deixando de ser garantida a 100%. É uma moeda, não um sistema — está implementada no topo do sistema Bitcoin."
          ),
        ],
      },
      {
        id: "crypto-n1-l-categorias-altcoins",
        title: "Categorias de Altcoins e Anonimato",
        duration: 15,
        content: [
          p(
            "Dinheiro anónimo exige unlinkability: para duas transações, ser impossível provar que foram enviadas à mesma conta/pessoa. A Bitcoin e muitas altcoins não fornecem isso, pois o endereço de destino vincula transações. Solução: criar um novo par de chaves (novo endereço) por transação — o problema passa a ser a distribuição da chave pública/endereço."
          ),
          h2("Plataformas Blockchain"),
          p(
            "Redes sobre as quais se constroem aplicações descentralizadas — a versão criptomoeda de um sistema operativo. Ethereum (ETH) é a maior; já emitiu mais de 280.000 tokens ERC-20. Rivais: Polkadot (DOT) e Cardano (ADA); também Tezos (XTZ), EOS e Tron (TRX)."
          ),
          h2("Pagamentos Digitais"),
          p(
            "Visam substituir a moeda fiduciária como padrão global de pagamento: Bitcoin Cash (BCH, hard fork de 2017), Litecoin (LTC, 2011, mais rápido), Stellar Lumens (XLM), XRP e Dogecoin (DOGE)."
          ),
          h2("Tokens Utilitários e DeFi"),
          p(
            "Tokens usados em soluções sobre plataformas blockchain: BNB (Binance), Chainlink (LINK, oráculo de dados), Swipe (SXP), Trust Wallet Token (TWT). DeFi (Finanças Descentralizadas) explodiu em 2020: Uniswap (UNI), SushiSwap (SUSHI), Compound (COMP) em Ethereum; PancakeSwap (CAKE) e Venus (XVS) na BSC. Stablecoins como Binance USD (BUSD) e tokens atrelados como Wrapped Bitcoin (WBTC) também são relevantes."
          ),
          p(
            "O investimento em criptomoedas está sujeito a alto risco de mercado; as opiniões acima não são aconselhamento financeiro."
          ),
        ],
      },
    ],
  },
  {
    id: "crypto-n1-mod-operacao",
    title: "Criptomoedas — Operação",
    order: 6,
    lessons: [
      {
        id: "crypto-n1-l-contas-transacoes",
        title: "Contas e Transações",
        duration: 14,
        content: [
          p(
            "Cada unidade de criptomoeda está 'associada' a uma conta. Ao contrário do banco, o blockchain não armazena o saldo, mas apenas as transações. O dinheiro numa conta é a soma dos UTXO (Unspent Transaction Output — transação de saída não gasta) que enviaram dinheiro para essa conta."
          ),
          p(
            "O proprietário tem um par de chaves pública-privada (Ku, Kr) por conta, armazenadas numa ou mais carteiras. Se a chave privada (Kr) for roubada, o ladrão pode fazer transações na conta. Na Bitcoin, o endereço é o hash da chave pública (20 bytes) e fornece pseudo-anonimato — mas o fluxo de dinheiro entre endereços é observável."
          ),
          p(
            "Integridade e autenticidade: apenas o dono da conta tem a chave privada (Kr) para produzir a assinatura S da transação."
          ),
        ],
      },
      {
        id: "crypto-n1-l-consenso-pow",
        title: "Consenso e Proof of Work (PoW)",
        duration: 15,
        content: [
          p(
            "Qual é o bloco anexado à blockchain? Aproximadamente o primeiro com uma prova de trabalho válida (PoW). Uma PoW obtém-se resolvendo um cryptopuzzle: o minerador calcula H(bloco anterior | nonce) e, se o hash for menor que um alvo, o nonce é um PoW válido."
          ),
          p(
            "É prova de trabalho porque requer muitas tentativas, consome muita energia e custa dinheiro ao minerador. A dificuldade varia mudando o alvo; o objetivo na BTC é 1 sucesso a cada 10 minutos. O consumo é elevado — comparável ao de países inteiros."
          ),
          p(
            "Incentivo: a recompensa da mineração de Bitcoin reduz-se para metade (halving) a cada 210.000 blocos, para evitar a inflação. Existem no máximo 21 milhões de BTC. Um nó só anexa um bloco se o PoW e todas as transações forem válidos e o hash do bloco anterior estiver correto — isto evita o gasto duplo."
          ),
        ],
        exercises: [
          {
            question: "De quanto em quanto tempo ocorre o 'halving' da recompensa de mineração de Bitcoin?",
            options: [
              "A cada 210.000 blocos",
              "A cada 10 minutos",
              "A cada 21 milhões de blocos",
              "Todos os anos a 1 de janeiro",
            ],
            correctIndex: 0,
          },
        ],
      },
      {
        id: "crypto-n1-l-propriedades",
        title: "Propriedades: Descentralização, Auditabilidade e Imutabilidade",
        duration: 12,
        content: [
          p(
            "Descentralização: sem entidade central, mineradores voluntários garantem o funcionamento. Mas grandes mining pools e os programadores do software são fontes de alguma centralização."
          ),
          p(
            "Auditabilidade: a blockchain é visível para 'todos' e verificável através de exploradores como blockchain.com, btc.com ou live.blockcypher.com."
          ),
          p(
            "Imutabilidade: cada bloco contém o hash criptográfico do bloco anterior (SHA-256). A resistência à colisão torna inviável substituir um bloco, pelo que a integridade da cadeia pode ser verificada. Desempenho/escalabilidade: a Bitcoin faz ~4 transações/seg, com atraso variável (ex.: ~1h para o bloco ser anexado + 1h para 6 blocos de confirmação)."
          ),
        ],
      },
    ],
  },
  {
    id: "crypto-n1-mod-wallets",
    title: "Wallets / Carteiras",
    order: 7,
    lessons: [
      {
        id: "crypto-n1-l-wallets",
        title: "Wallets / Carteiras",
        duration: 10,
        content: [
          p(
            "As carteiras são 'nós leves' que solicitam transações. Podem ser software (computador, telemóvel ou browser que contacta os mineradores), hardware ou até papel."
          ),
          p(
            "Funções das wallets: armazenar os pares de chaves da conta, guardar o saldo, permitir transações (ex.: pagamentos) e garantir segurança — a segurança da chave privada (Kr) é crítica."
          ),
          p(
            "Exemplos — Software: Trust Wallet, MetaMask. Hardware: Ledger, Trezor."
          ),
        ],
      },
    ],
  },
  {
    id: "crypto-n1-mod-negociar-investir",
    title: "Negociar ou Investir?",
    order: 8,
    lessons: [
      {
        id: "crypto-n1-l-negociar-investir",
        title: "Negociar ou Investir?",
        duration: 12,
        content: [
          p(
            "INVESTIR — escolher ativos em que se acredita e mantê-los por mais tempo; envolve menos tempo ativo e geralmente menos risco. NEGOCIAR (trading) — obter ganhos de curto/médio prazo através de compras e vendas regulares."
          ),
          p(
            "Ser bom trader exige tempo e prática: estratégias mais complexas, análise de mercados, plataformas de negociação, gestão de risco e custos de taxas. Os mercados de cripto são muitas vezes mais voláteis — a volatilidade dá lucro mas também alto risco."
          ),
          p(
            "Para iniciantes, INVESTIR é de longe a opção mais fácil e segura; a decisão baseia-se nos fundamentos da moeda (solidez do projeto e probabilidade de sucesso a longo prazo). Tudo depende da estratégia, perfil e tolerância ao risco — mas nunca invista fundos que não pode perder."
          ),
        ],
      },
    ],
  },
  {
    id: "crypto-n1-mod-dyor",
    title: "DYOR — Do Your Own Research",
    order: 9,
    lessons: [
      {
        id: "crypto-n1-l-dyor",
        title: "DYOR — Faça a sua própria pesquisa",
        duration: 14,
        content: [
          p(
            "DYOR (Do Your Own Research) significa fazer perguntas como: O que faz esta criptomoeda? Tem futuro? Existe outra que faz o mesmo mas melhor? A primeira etapa é ler um resumo do white paper, geralmente no site da moeda."
          ),
          p(
            "Três categorias de análise: FUNDAMENTO, TECNOLOGIA e ANÁLISE TÉCNICA. Na perspetiva fundamental, avaliar clientes, equipa e a sua reputação, marketing e parcerias. Idealmente, membros com 2+ anos numa Fortune 500 ou nos 20 principais projetos blockchain, e um desenvolvedor de sucesso com forte componente técnica."
          ),
          p(
            "Ver o hype no Twitter/Reddit e mergulhar no GitHub da moeda para rever o código: um projeto sem GitHub ou não atualizado regularmente é um sinal de alerta. Índice de liquidez: rácio de rotação = volume de negociação / capitalização de mercado. Regra prática: não investir numa cripto com taxa de rotatividade menor que 10%, pois pode ser difícil vender numa quebra de mercado."
          ),
        ],
        exercises: [
          {
            question: "O que significa a sigla DYOR?",
            options: [
              "Do Your Own Research (Faça a sua própria pesquisa)",
              "Digital Yield Over Risk",
              "Decentralized Yearly Ownership Rate",
              "Do Your Own Ranking",
            ],
            correctIndex: 0,
          },
        ],
      },
    ],
  },
  {
    id: "crypto-n1-mod-exchanges",
    title: "Exchanges",
    order: 10,
    lessons: [
      {
        id: "crypto-n1-l-exchanges",
        title: "Exchanges",
        duration: 8,
        content: [
          p(
            "As Exchanges permitem: trocar criptomoedas por dinheiro FIAT e vice-versa, staking e pools."
          ),
          p(
            "Exemplos: Binance, Coinbase, Coinbase Pro, Kraken, Crypto.com, KuCoin e CEX.IO."
          ),
        ],
      },
    ],
  },
  {
    id: "crypto-n1-mod-moedas-conhecer",
    title: "Moedas que Deve Conhecer",
    order: 11,
    lessons: [
      {
        id: "crypto-n1-l-moedas-conhecer",
        title: "Moedas que Deve Conhecer",
        duration: 8,
        content: [
          p(
            "Exemplos de criptomoedas a conhecer: BTC (Bitcoin), ETH (Ethereum), ADA (Cardano), BNB (Binance Coin), BCH (Bitcoin Cash), LTC (Litecoin), AAVE, DASH, IOTA, LINK (Chainlink), MKR (Maker), VET (Vechain), YFI (Yearn Finance), XLM, XMR (Monero), XRP (Ripple), ZCASH e DOGE."
          ),
          p(
            "Listas de referência: coincheckup.com (geral) e binance.com/en/markets (disponíveis na Binance)."
          ),
        ],
      },
    ],
  },
];

// --- Execução ----------------------------------------------------------------

async function run() {
  console.log(`🌱 A criar conteúdo no projeto Sanity "${projectId}" / dataset "${dataset}"...`);

  // 1. Categoria
  const categoryId = "cat-criptomoedas";
  await client.createOrReplace({
    _id: categoryId,
    _type: "category",
    title: "Criptomoedas & Blockchain",
    slug: { _type: "slug", current: "criptomoedas-blockchain" },
    description: "Fundamentos de criptomoedas, blockchain e ativos digitais.",
  });
  console.log("✓ Categoria criada");

  // 2. Lições + Módulos
  const moduleRefs: { _type: "reference"; _ref: string; _key: string }[] = [];

  for (const mod of modules) {
    const lessonRefs: { _type: "reference"; _ref: string; _key: string }[] = [];

    for (const lesson of mod.lessons) {
      await client.createOrReplace({
        _id: lesson.id,
        _type: "lesson",
        title: lesson.title,
        slug: { _type: "slug", current: lesson.id },
        duration: lesson.duration,
        videoProvider: "mux",
        isFree: lesson.isFree ?? false,
        content: lesson.content,
        exercises: (lesson.exercises ?? []).map((ex) => ({
          _type: "quiz",
          _key: k(),
          question: ex.question,
          options: ex.options,
          correctIndex: ex.correctIndex,
        })),
      });
      lessonRefs.push({ _type: "reference", _ref: lesson.id, _key: k() });
      console.log(`  ✓ Lição: ${lesson.title}`);
    }

    await client.createOrReplace({
      _id: mod.id,
      _type: "module",
      title: mod.title,
      order: mod.order,
      lessons: lessonRefs,
    });
    moduleRefs.push({ _type: "reference", _ref: mod.id, _key: k() });
    console.log(`✓ Módulo: ${mod.title}`);
  }

  // 3. Curso
  const courseId = "course-criptomoedas-n1";
  await client.createOrReplace({
    _id: courseId,
    _type: "course",
    title: "Criptomoedas — Fundamentos (Nível I)",
    slug: { _type: "slug", current: "criptomoedas-fundamentos-nivel-1" },
    description:
      "Curso introdutório sobre criptomoedas, Bitcoin, Ethereum, moeda fiduciária e blockchain. Formador: MsC. Eng. Pedro Varela Pinto.",
    category: { _type: "reference", _ref: categoryId },
    modules: moduleRefs,
  });
  console.log("✓ Curso criado");

  console.log("\n✅ Seed concluído. Próximo passo: npx tsx scripts/index-content.ts");
}

run().catch((err) => {
  console.error("❌ Erro no seed:", err);
  process.exit(1);
});
