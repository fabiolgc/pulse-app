import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/lib/toast";

const interTight = Inter_Tight({
  variable: "--font-pulse-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-pulse-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pulse — Monitor de Sinais B3",
  description: "Sistema de sinais de trading para mini contratos B3 com IA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${interTight.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
