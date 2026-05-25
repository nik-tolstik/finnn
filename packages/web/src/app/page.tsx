import { redirect } from "next/navigation";

import { getCachedServerSession } from "@/shared/lib/auth-session";

export default async function Home() {
  const session = await getCachedServerSession();

  if (session) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
