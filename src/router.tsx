import { lazy, Suspense, type ComponentType } from "react";
import { createHashRouter, Navigate, Outlet } from "react-router";
import { AnimatedLayout } from "@/layouts/animated-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { AsciiSpinner } from "@/components/ascii-spinner";

import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

const loadSplashScreen = () => import("@/screens/splash/splash-screen");
const SplashScreen = lazy(loadSplashScreen);
const loadLockScreen = () => import("@/screens/lock/lock-screen");
const LockScreen = lazy(loadLockScreen);
const loadWelcomeScreen = () => import("@/screens/setup/welcome-screen");
const WelcomeScreen = lazy(loadWelcomeScreen);
const loadCreateWalletScreen = () => import("@/screens/setup/create-wallet-screen");
const CreateWalletScreen = lazy(loadCreateWalletScreen);
const loadImportWalletScreen = () => import("@/screens/setup/import-wallet-screen");
const ImportWalletScreen = lazy(loadImportWalletScreen);
const loadDashboardScreen = () => import("@/screens/dashboard/dashboard-screen");
const DashboardScreen = lazy(loadDashboardScreen);
const loadWalletsScreen = () => import("@/screens/wallets/wallets-screen");
const WalletsScreen = lazy(loadWalletsScreen);
const loadWalletDetailScreen = () => import("@/screens/wallets/wallet-detail-screen");
const WalletDetailScreen = lazy(loadWalletDetailScreen);
const loadPortfolioScreen = () => import("@/screens/wallets/portfolio-screen");
const PortfolioScreen = lazy(loadPortfolioScreen);
const loadSendScreen = () => import("@/screens/send/send-screen");
const SendScreen = lazy(loadSendScreen);
const loadScheduledTransfersScreen = () => import("@/screens/send/scheduled-transfers-screen");
const ScheduledTransfersScreen = lazy(loadScheduledTransfersScreen);
const loadSendManyScreen = () => import("@/screens/send/send-many-screen");
const SendManyScreen = lazy(loadSendManyScreen);
const loadBurnScreen = () => import("@/screens/send/burn-screen");
const BurnScreen = lazy(loadBurnScreen);
const loadStakeScreen = () => import("@/screens/stake/stake-screen");
const StakeScreen = lazy(loadStakeScreen);
const loadReceiveScreen = () => import("@/screens/receive/receive-screen");
const ReceiveScreen = lazy(loadReceiveScreen);
const loadPaymentLinkScreen = () => import("@/screens/receive/payment-link-screen");
const PaymentLinkScreen = lazy(loadPaymentLinkScreen);
const loadHistoryScreen = () => import("@/screens/history/history-screen");
const HistoryScreen = lazy(loadHistoryScreen);
const loadTxDetailScreen = () => import("@/screens/history/tx-detail-screen");
const TxDetailScreen = lazy(loadTxDetailScreen);
const loadAnalyticsScreen = () => import("@/screens/history/analytics-screen");
const AnalyticsScreen = lazy(loadAnalyticsScreen);
const loadContactsScreen = () => import("@/screens/contacts/contacts-screen");
const ContactsScreen = lazy(loadContactsScreen);
const loadSearchScreen = () => import("@/screens/search/search-screen");
const SearchScreen = lazy(loadSearchScreen);
const loadRequestScreen = () => import("@/screens/request/request-screen");
const RequestScreen = lazy(loadRequestScreen);
const loadSettingsScreen = () => import("@/screens/settings/settings-screen");
const SettingsScreen = lazy(loadSettingsScreen);
const loadDappsScreen = () => import("@/screens/settings/dapps-screen");
const DappsScreen = lazy(loadDappsScreen);
const loadRequestHistoryScreen = () => import("@/screens/settings/request-history-screen");
const RequestHistoryScreen = lazy(loadRequestHistoryScreen);
const loadSecurityScreen = () => import("@/screens/settings/security-screen");
const SecurityScreen = lazy(loadSecurityScreen);
const loadAuditLogScreen = () => import("@/screens/settings/audit-log-screen");
const AuditLogScreen = lazy(loadAuditLogScreen);
const loadNetworkScreen = () => import("@/screens/settings/network-screen");
const NetworkScreen = lazy(loadNetworkScreen);
const loadNotificationsScreen = () => import("@/screens/settings/notifications-screen");
const NotificationsScreen = lazy(loadNotificationsScreen);
const loadSupportScreen = () => import("@/screens/settings/support-screen");
const SupportScreen = lazy(loadSupportScreen);
const loadDiagnosticsScreen = () => import("@/screens/settings/diagnostics-screen");
const DiagnosticsScreen = lazy(loadDiagnosticsScreen);
const loadAppearanceScreen = () => import("@/screens/settings/appearance-screen");
const AppearanceScreen = lazy(loadAppearanceScreen);

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

const SCREEN_LOADERS = [
  loadSplashScreen,
  loadLockScreen,
  loadWelcomeScreen,
  loadCreateWalletScreen,
  loadImportWalletScreen,
  loadDashboardScreen,
  loadWalletsScreen,
  loadWalletDetailScreen,
  loadPortfolioScreen,
  loadSendScreen,
  loadScheduledTransfersScreen,
  loadSendManyScreen,
  loadBurnScreen,
  loadStakeScreen,
  loadReceiveScreen,
  loadPaymentLinkScreen,
  loadHistoryScreen,
  loadTxDetailScreen,
  loadAnalyticsScreen,
  loadContactsScreen,
  loadSearchScreen,
  loadRequestScreen,
  loadSettingsScreen,
  loadDappsScreen,
  loadRequestHistoryScreen,
  loadSecurityScreen,
  loadAuditLogScreen,
  loadNetworkScreen,
  loadNotificationsScreen,
  loadSupportScreen,
  loadDiagnosticsScreen,
  loadAppearanceScreen,
];

let screensPrefetched = false;

/** Warm route chunks during idle so first navigation does not flash a fallback. */
function prefetchScreens() {
  if (screensPrefetched) return;
  screensPrefetched = true;
  for (const load of SCREEN_LOADERS) void load().catch(() => undefined);
}

if (typeof window !== "undefined") {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => prefetchScreens(), { timeout: 2_500 });
  } else {
    window.setTimeout(prefetchScreens, 1_500);
  }
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
