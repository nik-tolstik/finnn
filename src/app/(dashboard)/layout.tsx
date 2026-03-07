import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Suspense } from "react";

import { authOptions } from "@/shared/lib/auth";

import { ExchangeRatesTicker } from "./components/ExchangeRatesTicker";
import { FloatingActionButton } from "./components/FloatingActionButton";
import { Header } from "./components/Header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Suspense
        fallback={
          <div className="h-8 bg-muted/50 border-b">
            <div className="flex items-center h-full px-4 sm:px-8">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </div>
          </div>
        }
      >
        <ExchangeRatesTicker />
      </Suspense>
      <Header />
      <main className="flex-1 p-4 md:p-8">{children}</main>
      <FloatingActionButton />
    </div>
  );
}
