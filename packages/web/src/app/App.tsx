import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";

import { AppLoadingScreen } from "@/shared/components/app-loading-screen";

import { preloadMatchedProtectedRoute } from "./protected-route-preload";

function loadOnce<T>(loader: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined;
  return () => (promise ??= loader());
}

const HomeRoute = lazy(() => import("@/routes/HomeRoute"));
const AuthLayout = lazy(() => import("@/routes/auth/AuthLayout"));
const EmailRequiredRoute = lazy(() => import("@/routes/auth/EmailRequiredRoute"));
const ForgotPasswordRoute = lazy(() => import("@/routes/auth/ForgotPasswordRoute"));
const InviteRoute = lazy(() => import("@/routes/auth/InviteRoute"));
const LoginRoute = lazy(() => import("@/routes/auth/LoginRoute"));
const RegisterRoute = lazy(() => import("@/routes/auth/RegisterRoute"));
const ResetPasswordRoute = lazy(() => import("@/routes/auth/ResetPasswordRoute"));
const VerifyEmailRoute = lazy(() => import("@/routes/auth/VerifyEmailRoute"));
const loadDashboardLayout = loadOnce(() => import("@/routes/dashboard/DashboardLayout"));
const protectedRouteLoaders = {
  analytics: loadOnce(() => import("@/routes/dashboard/analytics/AnalyticsRoute")),
  dashboard: loadOnce(() => import("@/routes/dashboard/dashboard/DashboardRoute")),
  debts: loadOnce(() => import("@/routes/dashboard/debts/DebtsRoute")),
  payments: loadOnce(() => import("@/routes/dashboard/payments/PaymentsRoute")),
};
const DashboardLayout = lazy(() => {
  const layoutPromise = loadDashboardLayout();
  const routePromise = preloadMatchedProtectedRoute(window.location.pathname, protectedRouteLoaders);

  return routePromise
    ? Promise.all([layoutPromise, routePromise]).then(([layoutModule]) => layoutModule)
    : layoutPromise;
});
const AnalyticsRoute = lazy(protectedRouteLoaders.analytics);
const DashboardRoute = lazy(protectedRouteLoaders.dashboard);
const DebtsRoute = lazy(protectedRouteLoaders.debts);
const PaymentsRoute = lazy(protectedRouteLoaders.payments);

export function App() {
  return (
    <Suspense fallback={<AppLoadingScreen />}>
      <Routes>
        <Route index element={<HomeRoute />} />
        <Route element={<AuthLayout />}>
          <Route path="login" element={<LoginRoute />} />
          <Route path="register" element={<RegisterRoute />} />
          <Route path="forgot-password" element={<ForgotPasswordRoute />} />
          <Route path="reset-password" element={<ResetPasswordRoute />} />
          <Route path="email-required" element={<EmailRequiredRoute />} />
          <Route path="invite/:token" element={<InviteRoute />} />
          <Route path="verify-email/:token" element={<VerifyEmailRoute />} />
        </Route>
        <Route element={<DashboardLayout />}>
          <Route path="dashboard" element={<DashboardRoute />} />
          <Route path="analytics" element={<AnalyticsRoute />} />
          <Route path="debts" element={<DebtsRoute />} />
          <Route path="payments" element={<PaymentsRoute />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
