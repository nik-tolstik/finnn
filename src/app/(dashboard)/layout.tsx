import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";

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
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-muted/40">
        <nav className="p-4">
          <h2 className="mb-4 text-lg font-semibold">FinHub</h2>
          <ul className="space-y-2">
            <li>
              <a href="/dashboard" className="block rounded px-3 py-2 hover:bg-muted">
                Dashboard
              </a>
            </li>
            <li>
              <a href="/accounts" className="block rounded px-3 py-2 hover:bg-muted">
                Accounts
              </a>
            </li>
            <li>
              <a href="/transactions" className="block rounded px-3 py-2 hover:bg-muted">
                Transactions
              </a>
            </li>
            <li>
              <a href="/debts" className="block rounded px-3 py-2 hover:bg-muted">
                Debts
              </a>
            </li>
            <li>
              <a href="/categories" className="block rounded px-3 py-2 hover:bg-muted">
                Categories
              </a>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

