import { Suspense } from "react";

import { AnalyticsPageClient } from "./components/AnalyticsPageClient";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsPageClient />
    </Suspense>
  );
}
