import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/context/LanguageContext";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import AppLayoutShell from "@/components/AppLayoutShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Fardin Electricals - Back-Entry Inventory & Accounting",
  description: "High-performance billing and stock management for retail shops, optimized for weekly back-entry.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased dark`}>
      <body className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
        <LanguageProvider>
          {/* Main App Shell wrapper */}
          <AppLayoutShell>
            {children}
          </AppLayoutShell>
          
          {/* Keyboard Help Shortcuts Overlay */}
          <KeyboardShortcuts />
        </LanguageProvider>
      </body>
    </html>
  );
}
