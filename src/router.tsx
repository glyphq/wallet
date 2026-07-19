import { lazy, Suspense, type ComponentType } from "react";
import { createHashRouter } from "react-router-dom";
import { AnimatedLayout } from "@/layouts/animated-layout";
import { ErrorBoundary } from "@/components/error-boundary";

import SplashScreen from "@/screens/splash/splash-screen";
const LockScreen = lazy(() => import("@/screens/lock/lock-screen"));
const WelcomeScreen = lazy(() => import("@/screens/setup/welcome-screen"));
const CreateVaultScreen = lazy(() => import("@/screens/setup/create-vault-screen"));
const ImportVaultScreen = lazy(() => import("@/screens/setup/import-vault-screen"));
const DashboardScreen = lazy(() => import("@/screens/dashboard/dashboard-screen"));
const VaultsScreen = lazy(() => import("@/screens/vaults/vaults-screen"));
const VaultDetailScreen = lazy(() => import("@/screens/vaults/vault-detail-screen"));
const PortfolioScreen = lazy(() => import("@/screens/vaults/portfolio-screen"));
const SendScreen = lazy(() => import("@/screens/send/send-screen"));
const ScheduledTransfersScreen = lazy(() => import("@/screens/send/scheduled-transfers-screen"));
const SendManyScreen = lazy(() => import("@/screens/send/send-many-screen"));
const BurnScreen = lazy(() => import("@/screens/send/burn-screen"));
const StakeScreen = lazy(() => import("@/screens/stake/stake-screen"));
const ReceiveScreen = lazy(() => import("@/screens/receive/receive-screen"));
const PaymentLinkScreen = lazy(() => import("@/screens/receive/payment-link-screen"));
const HistoryScreen = lazy(() => import("@/screens/history/history-screen"));
const TxDetailScreen = lazy(() => import("@/screens/history/tx-detail-screen"));
const AnalyticsScreen = lazy(() => import("@/screens/history/analytics-screen"));
const ContactsScreen = lazy(() => import("@/screens/contacts/contacts-screen"));
const SearchScreen = lazy(() => import("@/screens/search/search-screen"));
const RequestScreen = lazy(() => import("@/screens/request/request-screen"));
const SettingsScreen = lazy(() => import("@/screens/settings/settings-screen"));
const DappsScreen = lazy(() => import("@/screens/settings/dapps-screen"));
const RequestHistoryScreen = lazy(() => import("@/screens/settings/request-history-screen"));
const SecurityScreen = lazy(() => import("@/screens/settings/security-screen"));
const AuditLogScreen = lazy(() => import("@/screens/settings/audit-log-screen"));
const NetworkScreen = lazy(() => import("@/screens/settings/network-screen"));
const NotificationsScreen = lazy(() => import("@/screens/settings/notifications-screen"));
const SupportScreen = lazy(() => import("@/screens/settings/support-screen"));
const DiagnosticsScreen = lazy(() => import("@/screens/settings/diagnostics-screen"));

function RouteFallback() {
  return (
    <div role="status" aria-live="polite" style={{ height: "100%", display: "grid", placeItems: "center", fontFamily: "var(--font-sans)", fontSize: "var(--text-label)", color: "var(--color-text-secondary)" }}>
      Loading screen...
    </div>
  );
}

function Screen({ component: C }: { component: ComponentType }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <C />
      </Suspense>
    </ErrorBoundary>
  );
}

export const router = createHashRouter([
  {
    element: <AnimatedLayout />,
    children: [
      { path: "/", element: <Screen component={SplashScreen} /> },
      { path: "/lock", element: <Screen component={LockScreen} /> },
      { path: "/setup", element: <Screen component={WelcomeScreen} /> },
      { path: "/setup/create", element: <Screen component={CreateVaultScreen} /> },
      { path: "/setup/import", element: <Screen component={ImportVaultScreen} /> },
      { path: "/dashboard", element: <Screen component={DashboardScreen} /> },
      { path: "/vaults", element: <Screen component={VaultsScreen} /> },
      { path: "/vaults/:id", element: <Screen component={VaultDetailScreen} /> },
      { path: "/vaults/:id/portfolio", element: <Screen component={PortfolioScreen} /> },
      { path: "/send", element: <Screen component={SendScreen} /> },
      { path: "/send/scheduled", element: <Screen component={ScheduledTransfersScreen} /> },
      { path: "/send-many", element: <Screen component={SendManyScreen} /> },
      { path: "/burn", element: <Screen component={BurnScreen} /> },
      { path: "/stake", element: <Screen component={StakeScreen} /> },
      { path: "/receive", element: <Screen component={ReceiveScreen} /> },
      { path: "/payment-link", element: <Screen component={PaymentLinkScreen} /> },
      { path: "/history", element: <Screen component={HistoryScreen} /> },
      { path: "/tx/:hash", element: <Screen component={TxDetailScreen} /> },
      { path: "/analytics", element: <Screen component={AnalyticsScreen} /> },
      { path: "/contacts", element: <Screen component={ContactsScreen} /> },
      { path: "/search", element: <Screen component={SearchScreen} /> },
      { path: "/request", element: <Screen component={RequestScreen} /> },
      { path: "/settings", element: <Screen component={SettingsScreen} /> },
      { path: "/settings/dapps", element: <Screen component={DappsScreen} /> },
      { path: "/settings/request-history", element: <Screen component={RequestHistoryScreen} /> },
      { path: "/settings/security", element: <Screen component={SecurityScreen} /> },
      { path: "/settings/security/audit-log", element: <Screen component={AuditLogScreen} /> },
      { path: "/settings/network", element: <Screen component={NetworkScreen} /> },
      { path: "/settings/contacts", element: <Screen component={ContactsScreen} /> },
      { path: "/settings/notifications", element: <Screen component={NotificationsScreen} /> },
      { path: "/settings/support", element: <Screen component={SupportScreen} /> },
      { path: "/settings/diagnostics", element: <Screen component={DiagnosticsScreen} /> },
    ],
  },
]);
