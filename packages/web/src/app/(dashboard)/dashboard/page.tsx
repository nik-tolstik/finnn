import { Suspense } from "react";

import { DashboardPageClient } from "./components/DashboardPageClient";

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageClient />
    </Suspense>
  );
}
