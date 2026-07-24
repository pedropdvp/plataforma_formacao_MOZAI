"use client";

import React, { useEffect, useState } from "react";

// Calculado no browser (não no servidor) para refletir o fuso horário real do aluno.
function getGreeting(hour: number): string {
  if (hour < 12) return "Bom dia";
  if (hour < 19) return "Boa tarde";
  return "Boa noite";
}

export default function GreetingText() {
  // Valor inicial neutro para o 1º render no servidor (hidratação), corrigido logo a seguir.
  const [greeting, setGreeting] = useState("Olá");

  useEffect(() => {
    setGreeting(getGreeting(new Date().getHours()));
  }, []);

  return <>{greeting}</>;
}
