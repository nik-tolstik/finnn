import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";

import { AppLoadingScreen } from "@/shared/components/app-loading-screen";

const HomeRoute = lazy(() => import("@/routes/HomeRoute"));
const AuthLayout = lazy(() => import("@/routes/auth/AuthLayout"));
const EmailRequiredRoute = lazy(() => import("@/routes/auth/EmailRequiredRoute"));
const ForgotPasswordRoute = lazy(() => import("@/routes/auth/ForgotPasswordRoute"));
const InviteRoute = lazy(() => import("@/routes/auth/InviteRoute"));
const LoginRoute = lazy(() => import("@/routes/auth/LoginRoute"));
const RegisterRoute = lazy(() => import("@/routes/auth/RegisterRoute"));
const ResetPasswordRoute = lazy(() => import("@/routes/auth/ResetPasswordRoute"));
const VerifyEmailRoute = lazy(() => import("@/routes/auth/VerifyEmailRoute"));
const DashboardLayout = lazy(() => import("@/routes/dashboard/DashboardLayout"));
const AnalyticsRoute = lazy(() => import("@/routes/dashboard/analytics/AnalyticsRoute"));
const DashboardRoute = lazy(() => import("@/routes/dashboard/dashboard/DashboardRoute"));
const DebtsRoute = lazy(() => import("@/routes/dashboard/debts/DebtsRoute"));
const PaymentsRoute = lazy(() => import("@/routes/dashboard/payments/PaymentsRoute"));

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
