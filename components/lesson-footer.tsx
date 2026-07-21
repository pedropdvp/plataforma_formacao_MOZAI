"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Loader2, Award, AlertCircle } from "lucide-react";

interface LessonFooterProps {
  courseId: string;
  lessonId: string;
  nextLessonHref: string | null;
  exercises?: Array<{
    question: string;
    options: string[];
    correct: string;
  }>;
}

const QUIZ_QUESTIONS: Record<string, Record<string, Array<{ question: string; options: string[]; correct: string }>>> = {
  "course-1": {
    "lesson-1-1": [
      {
        question: "Qual a principal diferença entre e-learning tradicional e tutoria ativa na MOZAI?",
        options: [
          "O tutor de IA usa RAG local acoplado ao player para responder a dúvidas no contexto da aula",
          "A MOZAI apenas fornece vídeos gravados sem qualquer suporte de inteligência",
          "O suporte é prestado exclusivamente por professores humanos via fórum de e-mail"
        ],
        correct: "O tutor de IA usa RAG local acoplado ao player para responder a dúvidas no contexto da aula"
      },
      {
        question: "Como o Digital Twin armazena os tópicos mais pesquisados?",
        options: [
          "Persistindo logs cognitivos de palavras-chave na coleção do MongoDB do aluno",
          "Num ficheiro temporário descarregado no computador do aluno",
          "Guardando apenas na cache do navegador do utilizador"
        ],
        correct: "Persistindo logs cognitivos de palavras-chave na coleção do MongoDB do aluno"
      }
    ],
    "lesson-1-2": [
      {
        question: "Qual modelo de embedding e tipo de segmentação otimizámos na Fase 5?",
        options: [
          "Modelo text-embedding-3-small com segmentação semântica baseada em sentenças",
          "Modelo gpt-4o-mini com divisão simples a cada 10 palavras",
          "Modelo text-davinci-003 sem sobreposição ou divisão de parágrafos"
        ],
        correct: "Modelo text-embedding-3-small com segmentação semântica baseada em sentenças"
      }
    ],
    "lesson-1-3": [
      {
        question: "Como garantimos isolamento estrito de inquilino (Tenant Isolation) nas pesquisas vetoriais?",
        options: [
          "Aplicando filtros lógicos com o parâmetro 'filter' diretamente no estágio $vectorSearch",
          "Criando uma base de dados MongoDB Atlas física diferente para cada colaborador",
          "Filtrando manualmente no código Node.js após descarregar todos os dados"
        ],
        correct: "Aplicando filtros lógicos com o parâmetro 'filter' diretamente no estágio $vectorSearch"
      }
    ]
  },
  "course-2": {
    "lesson-1-1": [
      {
        question: "Onde são executados por defeito os React Server Components (RSC) no Next.js 16?",
        options: [
          "No servidor, permitindo aceder diretamente a bases de dados com segurança",
          "No browser do cliente, necessitando do carregamento de pacotes NPM pesados",
          "Apenas em servidores web externos sem suporte a layouts flexíveis"
        ],
        correct: "No servidor, permitindo aceder diretamente a bases de dados com segurança"
      }
    ],
    "lesson-1-2": [
      {
        question: "Como o middleware.ts ajuda no suporte a multi-tenancy?",
        options: [
          "Extraindo o subdomínio ou lendo cookies de inquilino e injetando o cabeçalho 'x-tenant-id'",
          "Bloqueando todas as ligações que não venham de e-mails do Gmail",
          "Configurando as tabelas do banco de dados relacional automaticamente"
        ],
        correct: "Extraindo o subdomínio ou lendo cookies de inquilino e injetando o cabeçalho 'x-tenant-id'"
      }
    ]
  },
  "course-3": {
    "lesson-1-1": [
      {
        question: "O que representa a EVM no ecossistema de Smart Contracts?",
        options: [
          "Ethereum Virtual Machine: o motor que executa bytecode Solidity descentralizado",
          "Enterprise Value Matrix: o painel de KPIs de transações financeiras",
          "External Verified Maker: a entidade que audita auditorias manuais"
        ],
        correct: "Ethereum Virtual Machine: o motor que executa bytecode Solidity descentralizado"
      }
    ]
  },
  "course-4": {
    "lesson-1-1": [
      {
        question: "Segundo o material do Eng. Pedro Varela Pinto, qual é a definição formal de uma criptomoeda descentralizada?",
        options: [
          "É um sistema que não requer autoridade central, é distribuído, e a propriedade é provada exclusivamente por criptografia",
          "É um sistema centralizado controlado inteiramente pelo Fundo Monetário Internacional (FMI)",
          "É uma moeda digital impressa pelo Banco Central Europeu sob o padrão-ouro"
        ],
        correct: "É um sistema que não requer autoridade central, é distribuído, e a propriedade é provada exclusivamente por criptografia"
      },
      {
        question: "Quem é o indivíduo/grupo creditado com a criação da primeira criptomoeda descentralizada (Bitcoin) em 2009?",
        options: [
          "Satoshi Nakamoto",
          "Vitalik Buterin",
          "Pedro Varela Pinto"
        ],
        correct: "Satoshi Nakamoto"
      }
    ],
    "lesson-1-2": [
      {
        question: "Qual a diferença fundamental das Stablecoins (como o Tether USDT) em relação à Bitcoin?",
        options: [
          "São atreladas (PEG) a moedas fiduciárias como o USD para manter a estabilidade do preço 1:1",
          "Têm fornecimento completamente imprevisível e flutuam mais do que Altcoins",
          "São mineradas de forma descentralizada por todos os computadores da rede sem qualquer garantia"
        ],
        correct: "São atreladas (PEG) a moedas fiduciárias como o USD para manter a estabilidade do preço 1:1"
      }
    ],
    "lesson-1-3": [
      {
        question: "Como se chama o tipo de wallet que armazena fisicamente as chaves privadas offline (como Ledger ou Trezor)?",
        options: [
          "Hardware Wallet",
          "Software Wallet",
          "Paper Wallet"
        ],
        correct: "Hardware Wallet"
      }
    ]
  }
};

export default function LessonFooter({ courseId, lessonId, nextLessonHref, exercises }: LessonFooterProps) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Estados do Quiz Drawer
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [quizError, setQuizError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Carregar progresso inicial
  useEffect(() => {
    async function checkProgress() {
      try {
        const res = await fetch(`/api/progress?courseId=${courseId}`);
        if (res.ok) {
          const data = await res.json();
          const activeProgress = data.progress?.find((p: any) => p.lessonId === lessonId);
          if (activeProgress && activeProgress.status === "completed") {
            setIsCompleted(true);
          }
        }
      } catch (error) {
        console.error("Erro ao ler progresso:", error);
      } finally {
        setIsLoading(false);
      }
    }

    checkProgress();
  }, [courseId, lessonId]);

  // Carregar as perguntas do mini-quiz para a lição
  const loadQuiz = () => {
    let questions = [];
    if (exercises && exercises.length > 0) {
      questions = exercises;
    } else {
      const courseQ = QUIZ_QUESTIONS[courseId];
      questions = (courseQ && courseQ[lessonId]) || [
        {
          question: "Qual o principal objetivo prático dos conhecimentos consolidados nesta lição?",
          options: [
            "Aumentar o índice de fluência no Grafo de Competências do AI Skills OS",
            "Não possui qualquer impacto na avaliação de conhecimentos",
            "Assistir às aulas de forma puramente passiva sem avaliação"
          ],
          correct: "Aumentar o índice de fluência no Grafo de Competências do AI Skills OS"
        }
      ];
    }

    setQuizQuestions(questions);
    setSelectedAnswers({});
    setQuizError(null);
    setShowQuiz(true);
  };

  // Enviar respostas e validar
  const handleQuizSubmit = async () => {
    setQuizError(null);

    // Validar se todas as perguntas foram respondidas
    if (Object.keys(selectedAnswers).length < quizQuestions.length) {
      setQuizError("Por favor, responda a todas as perguntas antes de submeter.");
      return;
    }

    // Validar respostas corretas e mapear erros
    let hasMistake = false;
    const erroredQuestions: any[] = [];
    quizQuestions.forEach((q, idx) => {
      if (selectedAnswers[idx] !== q.correct) {
        hasMistake = true;
        erroredQuestions.push({
          questionText: q.question,
          selectedOption: selectedAnswers[idx],
          correctOption: q.correct
        });
      }
    });

    if (hasMistake) {
      setQuizError("Pelo menos uma das respostas está incorreta. Reveja os temas e tente novamente!");
      
      // Registrar tentativa incorreta para relatórios pedagógicos de professores
      try {
        const correctCount = quizQuestions.length - erroredQuestions.length;
        await fetch("/api/quiz/attempt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            courseId,
            lessonId,
            score: correctCount / quizQuestions.length,
            correctAnswers: correctCount,
            totalQuestions: quizQuestions.length,
            erroredQuestions
          })
        });
      } catch (err) {
        console.warn("Erro ao registar tentativa falhada de quiz:", err);
      }
      return;
    }

    // Se passou, gravar progresso concluído no banco
    setIsSaving(true);
    setShowQuiz(false);

    try {
      // 1. Gravar progresso concluído
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseId,
          lessonId,
          status: "completed",
          watchTime: 180,
        }),
      });

      if (res.ok) {
        setIsCompleted(true);
        setShowSuccessModal(true);

        // 2. Registrar tentativa correta (100% acertos) -> Concede XP e badge de quiz
        try {
          await fetch("/api/quiz/attempt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courseId,
              lessonId,
              score: 1.0,
              correctAnswers: quizQuestions.length,
              totalQuestions: quizQuestions.length,
              erroredQuestions: []
            })
          });
        } catch (e) {
          console.warn("Erro ao salvar tentativa de quiz com sucesso:", e);
        }

        // 3. Atribuir XP de Conclusão da Aula na Gamificação (+15 XP)
        try {
          await fetch("/api/gamification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "lesson_completed"
            })
          });
        } catch (e) {
          console.warn("Erro ao creditar XP de aula concluída:", e);
        }
      }
    } catch (error) {
      console.error("Erro ao gravar progresso concluído:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Alternar progresso
  const handleToggleCompletion = async () => {
    if (isCompleted) {
      // Se já estava concluída, permite desmarcar diretamente
      setIsSaving(true);
      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            courseId,
            lessonId,
            status: "in-progress",
            watchTime: 0,
          }),
        });

        if (res.ok) {
          setIsCompleted(false);
        }
      } catch (error) {
        console.error("Erro ao redefinir progresso:", error);
      } finally {
        setIsSaving(false);
      }
    } else {
      // Se não está concluída, exige passar no mini-quiz corporativo
      loadQuiz();
    }
  };

  return (
    <>
      <div className="border-t border-slate-900 pt-6 mt-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className={`h-5 w-5 ${isCompleted ? "text-emerald-400" : "text-slate-600"}`} />
          <span className="text-xs text-slate-400 font-medium">
            {isLoading ? "A carregar progresso..." : isCompleted ? "Aula Concluída!" : "Lição concluída?"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleCompletion}
            disabled={isLoading || isSaving}
            className={`h-9 px-4 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border cursor-pointer ${
              isCompleted
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                : "border-slate-800 text-slate-350 hover:bg-slate-900"
            }`}
          >
            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
            {isCompleted ? "Concluída ✓" : "Validar com Mini-Quiz"}
          </button>
          
          {nextLessonHref ? (
            <Link
              href={nextLessonHref}
              className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              Próxima Aula
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="text-xs text-slate-650 italic">Fim do Curso</span>
          )}
        </div>
      </div>

      {/* DRAWER MODAL DE MINI-QUIZ PEDAGÓGICO */}
      {showQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-900 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-900 bg-slate-900/10 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">MOZAI active-learning: Mini-Quiz</h3>
                <span className="text-[9px] text-indigo-400 font-mono tracking-widest uppercase">Validação de Retenção Pedagógica</span>
              </div>
            </div>

            {/* Questions List */}
            <div className="p-6 space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar">
              {quizQuestions.map((q, qIdx) => (
                <div key={qIdx} className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-200 leading-relaxed">
                    {qIdx + 1}. {q.question}
                  </h4>
                  <div className="space-y-2">
                    {q.options.map((opt: string, optIdx: number) => {
                      const isSelected = selectedAnswers[qIdx] === opt;
                      return (
                        <div
                          key={optIdx}
                          onClick={() => setSelectedAnswers({ ...selectedAnswers, [qIdx]: opt })}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-500/5 text-white"
                              : "border-slate-900 bg-slate-950/40 hover:border-slate-800 text-slate-400"
                          }`}
                        >
                          {opt}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {quizError && (
              <div className="mx-6 p-3 rounded-xl border border-rose-500/25 bg-rose-500/10 text-rose-400 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                <span>{quizError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="p-6 border-t border-slate-900 flex gap-3">
              <button
                onClick={() => setShowQuiz(false)}
                className="flex-1 h-10 rounded-xl border border-slate-800 text-xs font-semibold text-slate-400 hover:bg-slate-900 transition-colors"
              >
                Voltar à Aula
              </button>
              <button
                onClick={handleQuizSubmit}
                className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all flex items-center justify-center cursor-pointer shadow-lg shadow-indigo-600/10"
              >
                Submeter Respostas
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE SUCESSO PREMIUM DARK GLASSMORPHIC */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-950 border border-slate-900 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl p-6 text-center space-y-6 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl" />
            
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto relative z-10 shadow-lg shadow-emerald-500/5 animate-bounce">
              <Award className="h-8 w-8" />
            </div>

            <div className="space-y-2 relative z-10">
              <h3 className="font-extrabold text-white text-base">Mini-Quiz Superado!</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Excelente trabalho! Demonstrou grande compreensão técnica. A lição foi registada como concluída no seu perfil e as suas competências foram atualizadas.
              </p>
            </div>

            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-semibold text-slate-950 transition-all cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              Continuar Percurso
            </button>
          </div>
        </div>
      )}
    </>
  );
}
