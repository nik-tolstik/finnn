import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import Script from "next/script";

import "./globals.css";

import { Toaster } from "@/shared/ui/sonner";

import { Providers } from "./providers";

const onest = Onest({
  subsets: ["cyrillic", "latin"],
  variable: "--font-onest",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finnn - Учёт финансов",
  description: "Ведите учёт своих финансов с лёгкостью",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Finnn",
  },
  icons: {
    icon: [
      {
        url: "/logo-dark.svg",
        type: "image/svg+xml",
        sizes: "any",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/logo-light.svg",
        type: "image/svg+xml",
        sizes: "any",
        media: "(prefers-color-scheme: dark)",
      },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f7" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1c" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={onest.variable} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <Providers>
          {children}
          <Toaster />
          <SpeedInsights />
        </Providers>
      </body>
    </html>
  );
}
