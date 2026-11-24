import { lazy, Suspense, type ComponentType } from "react";
import { createHashRouter, Navigate, Outlet } from "react-router";
import { AnimatedLayout } from "@/layouts/animated-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { AsciiSpinner } from "@/components/ascii-spinner";

import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const SplashScreen = lazy(() => import("@/screens/splash/splash-screen"));
const LockScreen = lazy(() => import("@/screens/lock/lock-screen"));
const WelcomeScreen = lazy(() => import("@/screens/setup/welcome-screen"));
const CreateWalletScreen = lazy(() => import("@/screens/setup/create-wallet-screen"));
const ImportWalletScreen = lazy(() => import("@/screens/setup/import-wallet-screen"));
const DashboardScreen = lazy(() => import("@/screens/dashboard/dashboard-screen"));
const WalletsScreen = lazy(() => import("@/screens/wallets/wallets-screen"));
const WalletDetailScreen = lazy(() => import("@/screens/wallets/wallet-detail-screen"));
const PortfolioScreen = lazy(() => import("@/screens/wallets/portfolio-screen"));
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
const AppearanceScreen = lazy(() => import("@/screens/settings/appearance-screen"));

function RouteFallback() {
  return (
    <div
      role="status"
      aria-label="Loading screen"
      style={{ height: "100%", display: "grid", placeItems: "center", background: "var(--color-bg-base)" }}
    >
      <AsciiSpinner size={104} />
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

/**
 * Keeps all sensitive application screens behind one lock-state boundary.
 * Individual screens must not decide whether their own data is safe to show.
 */
function UnlockedRoute() {
  const isLocked = useSessionStore((state) => state.isLocked);
  const hasWallets = usePersistedStore((state) => state.wallets.length > 0);

  // Never render persisted account data before hydration has completed.
  if (!usePersistedStore.persist.hasHydrated()) {
    return <Screen component={SplashScreen} />;
  }
  if (!hasWallets) return <Navigate to="/setup" replace />;
  if (isLocked) return <Navigate to="/lock" replace />;
  return <Outlet />;
}

export const router = createHashRouter([
  {
    element: <AnimatedLayout />,
    children: [
      { path: "/", element: <Screen component={SplashScreen} /> },
      { path: "/lock", element: <Screen component={LockScreen} /> },
      { path: "/setup", element: <Screen component={WelcomeScreen} /> },
      { path: "/setup/create", element: <Screen component={CreateWalletScreen} /> },
      { path: "/setup/import", element: <Screen component={ImportWalletScreen} /> },
      {
        element: <UnlockedRoute />,
        children: [
          { path: "/dashboard", element: <Screen component={DashboardScreen} /> },
          { path: "/wallets", element: <Screen component={WalletsScreen} /> },
          { path: "/wallets/:id", element: <Screen component={WalletDetailScreen} /> },
          { path: "/wallets/:id/portfolio", element: <Screen component={PortfolioScreen} /> },
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
          { path: "/settings/appearance", element: <Screen component={AppearanceScreen} /> },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
