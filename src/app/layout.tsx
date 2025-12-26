import type { Metadata } from "next";

import "./globals.css";
import { Toaster } from "@/shared/ui/sonner";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "FinHub - Учёт финансов",
  description: "Ведите учёт своих финансов с лёгкостью",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
