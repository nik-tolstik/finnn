import type { Metadata } from "next";

import "./globals.css";
import { Toaster } from "@/shared/ui/sonner";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "FinHub - Учёт финансов",
  description: "Ведите учёт своих финансов с лёгкостью",
  manifest: "/manifest.json",
  themeColor: "#000000",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FinHub",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-192.png",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
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
