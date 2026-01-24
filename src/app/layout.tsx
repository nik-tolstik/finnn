import type { Metadata, Viewport } from "next";

import "./globals.css";
import { Toaster } from "@/shared/ui/sonner";

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "FinHub - Учёт финансов",
  description: "Ведите учёт своих финансов с лёгкостью",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FinHub",
  },
  icons: {
    icon: "/logo-dark.svg",
    apple: "/logo-dark.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
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
