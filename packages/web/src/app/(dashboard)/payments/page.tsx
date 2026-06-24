import { Suspense } from "react";

import { PaymentsPageClient } from "./components/PaymentsPageClient";

export default function PaymentsPage() {
  return (
    <Suspense fallback={null}>
      <PaymentsPageClient />
    </Suspense>
  );
}
