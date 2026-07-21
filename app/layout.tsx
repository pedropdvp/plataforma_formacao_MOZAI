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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
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
                  {children}
                </ToastProvider>
              </AccessProvider>
            </ThemeProvider>
          </LanguageProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

