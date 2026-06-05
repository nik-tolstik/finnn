import { Suspense } from "react";

import { DebtsPageClient } from "./components/DebtsPageClient";

export default function DebtsPage() {
  return (
    <Suspense fallback={null}>
      <DebtsPageClient />
    </Suspense>
  );
}
