import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "NDRC Skills - Compétences Digitales",
  description: "Suivi des compétences E4/E5 pour le BTS NDRC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${nunito.variable} antialiased bg-slate-50`}>
        {children}
      </body>
    </html>
  );
}
