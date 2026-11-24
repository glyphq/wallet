import { lazy, Suspense, type ComponentType } from "react";
import { createHashRouter, Navigate, Outlet } from "react-router";
import { AnimatedLayout } from "@/layouts/animated-layout";
import { ErrorBoundary, RouteErrorBoundary } from "@/components/error-boundary";
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
const loadAccountsScreen = () => import("@/screens/accounts/accounts-screen");
const AccountsScreen = lazy(loadAccountsScreen);
const loadAccountAddScreen = () => import("@/screens/accounts/account-add-screen");
const AccountAddScreen = lazy(loadAccountAddScreen);
const loadAccountDetailScreen = () => import("@/screens/accounts/account-detail-screen");
const AccountDetailScreen = lazy(loadAccountDetailScreen);
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
const loadMultisigScreen = () => import("@/screens/multisig/multisig-screen");
const MultisigScreen = lazy(loadMultisigScreen);
const loadMultisigCreateScreen = () => import("@/screens/multisig/multisig-create-screen");
const MultisigCreateScreen = lazy(loadMultisigCreateScreen);
const loadMultisigDetailScreen = () => import("@/screens/multisig/multisig-detail-screen");
const MultisigDetailScreen = lazy(loadMultisigDetailScreen);
const loadMultisigDepositScreen = () => import("@/screens/multisig/multisig-deposit-screen");
const MultisigDepositScreen = lazy(loadMultisigDepositScreen);
const loadMultisigReleaseScreen = () => import("@/screens/multisig/multisig-release-screen");
const MultisigReleaseScreen = lazy(loadMultisigReleaseScreen);
const loadMultisigApprovalsScreen = () => import("@/screens/multisig/multisig-approvals-screen");
const MultisigApprovalsScreen = lazy(loadMultisigApprovalsScreen);
const loadMultisigApprovalScreen = () => import("@/screens/multisig/multisig-approval-screen");
const MultisigApprovalScreen = lazy(loadMultisigApprovalScreen);
const loadReceiveScreen = () => import("@/screens/receive/receive-screen");
const ReceiveScreen = lazy(loadReceiveScreen);
const loadHistoryScreen = () => import("@/screens/history/history-screen");
const HistoryScreen = lazy(loadHistoryScreen);
const loadTxDetailScreen = () => import("@/screens/history/tx-detail-screen");
const TxDetailScreen = lazy(loadTxDetailScreen);
const loadAnalyticsScreen = () => import("@/screens/history/analytics-screen");
const AnalyticsScreen = lazy(loadAnalyticsScreen);
const loadContactsScreen = () => import("@/screens/contacts/contacts-screen");
const ContactsScreen = lazy(loadContactsScreen);
const loadContactEditorScreen = () => import("@/screens/contacts/contact-editor-screen");
const ContactEditorScreen = lazy(loadContactEditorScreen);
const loadContactsTransferScreen = () => import("@/screens/contacts/contacts-transfer-screen");
const ContactsTransferScreen = lazy(loadContactsTransferScreen);
const loadSearchScreen = () => import("@/screens/search/search-screen");
const SearchScreen = lazy(loadSearchScreen);
const loadRequestScreen = () => import("@/screens/request/request-screen");
const RequestScreen = lazy(loadRequestScreen);
const loadSettingsScreen = () => import("@/screens/settings/settings-screen");
const SettingsScreen = lazy(loadSettingsScreen);
const loadRequestHistoryScreen = () => import("@/screens/settings/request-history-screen");
const RequestHistoryScreen = lazy(loadRequestHistoryScreen);
const loadRequestHistoryDetailScreen = () => import("@/screens/settings/request-history-detail-screen");
const RequestHistoryDetailScreen = lazy(loadRequestHistoryDetailScreen);
const loadSecurityScreen = () => import("@/screens/settings/security-screen");
const SecurityScreen = lazy(loadSecurityScreen);
const loadAuditLogScreen = () => import("@/screens/settings/audit-log-screen");
const AuditLogScreen = lazy(loadAuditLogScreen);
const loadNetworkScreen = () => import("@/screens/settings/network-screen");
const NetworkScreen = lazy(loadNetworkScreen);
const loadNotificationsScreen = () => import("@/screens/settings/notifications-screen");
const NotificationsScreen = lazy(loadNotificationsScreen);
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
  loadAccountsScreen,
  loadAccountAddScreen,
  loadAccountDetailScreen,
  loadSendScreen,
  loadScheduledTransfersScreen,
  loadSendManyScreen,
  loadBurnScreen,
  loadStakeScreen,
  loadMultisigScreen,
  loadMultisigCreateScreen,
  loadMultisigDetailScreen,
  loadMultisigDepositScreen,
  loadMultisigReleaseScreen,
  loadMultisigApprovalsScreen,
  loadMultisigApprovalScreen,
  loadReceiveScreen,
  loadHistoryScreen,
  loadTxDetailScreen,
  loadAnalyticsScreen,
  loadContactsScreen,
  loadContactEditorScreen,
  loadContactsTransferScreen,
  loadSearchScreen,
  loadRequestScreen,
  loadSettingsScreen,
  loadRequestHistoryScreen,
  loadRequestHistoryDetailScreen,
  loadSecurityScreen,
  loadAuditLogScreen,
  loadNetworkScreen,
  loadNotificationsScreen,
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
    errorElement: <RouteErrorBoundary />,
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
          { path: "/accounts", element: <Screen component={AccountsScreen} /> },
          { path: "/accounts/add", element: <Screen component={AccountAddScreen} /> },
          { path: "/accounts/:index", element: <Screen component={AccountDetailScreen} /> },
          { path: "/send", element: <Screen component={SendScreen} /> },
          { path: "/send/scheduled", element: <Screen component={ScheduledTransfersScreen} /> },
          { path: "/send-many", element: <Screen component={SendManyScreen} /> },
          { path: "/burn", element: <Screen component={BurnScreen} /> },
          { path: "/stake", element: <Screen component={StakeScreen} /> },
          { path: "/multisig", element: <Screen component={MultisigScreen} /> },
          { path: "/multisig/new", element: <Screen component={MultisigCreateScreen} /> },
          { path: "/multisig/:id", element: <Screen component={MultisigDetailScreen} /> },
          { path: "/multisig/:id/deposit", element: <Screen component={MultisigDepositScreen} /> },
          { path: "/multisig/:id/release", element: <Screen component={MultisigReleaseScreen} /> },
          { path: "/multisig/:id/approvals", element: <Screen component={MultisigApprovalsScreen} /> },
          { path: "/multisig/:id/approval", element: <Screen component={MultisigApprovalScreen} /> },
          { path: "/receive", element: <Screen component={ReceiveScreen} /> },
          { path: "/history", element: <Screen component={HistoryScreen} /> },
          { path: "/tx/:hash", element: <Screen component={TxDetailScreen} /> },
          { path: "/analytics", element: <Screen component={AnalyticsScreen} /> },
          { path: "/contacts", element: <Screen component={ContactsScreen} /> },
          { path: "/contacts/new", element: <Screen component={ContactEditorScreen} /> },
          { path: "/contacts/transfer", element: <Screen component={ContactsTransferScreen} /> },
          { path: "/contacts/:id/edit", element: <Screen component={ContactEditorScreen} /> },
          { path: "/search", element: <Screen component={SearchScreen} /> },
          { path: "/request", element: <Screen component={RequestScreen} /> },
          { path: "/settings", element: <Screen component={SettingsScreen} /> },
          { path: "/settings/request-history", element: <Screen component={RequestHistoryScreen} /> },
          { path: "/settings/request-history/detail", element: <Screen component={RequestHistoryDetailScreen} /> },
          { path: "/settings/security", element: <Screen component={SecurityScreen} /> },
          { path: "/settings/security/audit-log", element: <Screen component={AuditLogScreen} /> },
          { path: "/settings/network", element: <Screen component={NetworkScreen} /> },
          { path: "/settings/contacts", element: <Screen component={ContactsScreen} /> },
          { path: "/settings/notifications", element: <Screen component={NotificationsScreen} /> },
          { path: "/settings/diagnostics", element: <Screen component={DiagnosticsScreen} /> },
          { path: "/settings/appearance", element: <Screen component={AppearanceScreen} /> },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
