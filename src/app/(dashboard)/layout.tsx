import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/shared/lib/auth";

import { Header } from "./components/Header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
