import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MOZAI - AI Education Platform",
  description: "Sistema Operativo Global para Educação Tecnológica baseada em IA.",
};

import { AccessProvider } from "@/hooks/use-access";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/hooks/use-language";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // As rotas de autenticação são fixas — `app/(auth)/sign-in` e `sign-up` — e ficam
  // aqui escritas em vez de virem de NEXT_PUBLIC_CLERK_SIGN_IN_URL. Não é preferência:
  // um valor que começa por "/" é convertido em caminho do Windows quando passa por um
  // shell MSYS (Git Bash), e foi o que aconteceu em produção — o Clerk ficou a
  // redireccionar para "C:/.../Git/sign-in" e todas as rotas protegidas respondiam 404
  // a quem não tivesse sessão. Como não há motivo para estas rotas serem
  // configuráveis, deixam de o ser.
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html
        lang="pt-PT"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head>
          <script dangerouslySetInnerHTML={{ __html: `
            try {
              const saved = localStorage.getItem("theme");
              if (saved === "light") {
                document.documentElement.classList.add("light");
              } else {
                document.documentElement.classList.remove("light");
              }
            } catch (e) {}
          `}} />
        </head>
        <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">
          <LanguageProvider>
            <ThemeProvider>
              <AccessProvider>
                <ToastProvider>
                  <ConfirmDialogProvider>
                    {children}
                  </ConfirmDialogProvider>
                </ToastProvider>
              </AccessProvider>
            </ThemeProvider>
          </LanguageProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

