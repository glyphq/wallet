import type { ComponentType } from "react";
import { createHashRouter, Navigate, Outlet } from "react-router";
import { AnimatedLayout } from "@/layouts/animated-layout";
import { ErrorBoundary, RouteErrorBoundary } from "@/components/error-boundary";

import { usePersistedStore } from "@/store/persisted";
import { useSessionStore } from "@/store/session";

import SplashScreen from "@/screens/splash/splash-screen";
import LockScreen from "@/screens/lock/lock-screen";
import WelcomeScreen from "@/screens/setup/welcome-screen";
import CreateWalletScreen from "@/screens/setup/create-wallet-screen";
import ImportWalletScreen from "@/screens/setup/import-wallet-screen";
import DashboardScreen from "@/screens/dashboard/dashboard-screen";
import WalletsScreen from "@/screens/wallets/wallets-screen";
import WalletDetailScreen from "@/screens/wallets/wallet-detail-screen";
import PortfolioScreen from "@/screens/wallets/portfolio-screen";
import AccountsScreen from "@/screens/accounts/accounts-screen";
import AccountAddScreen from "@/screens/accounts/account-add-screen";
import AccountDetailScreen from "@/screens/accounts/account-detail-screen";
import AccountExportScreen from "@/screens/accounts/account-export-screen";
import SendScreen from "@/screens/send/send-screen";
import ScheduledTransfersScreen from "@/screens/send/scheduled-transfers-screen";
import MultisigScreen from "@/screens/multisig/multisig-screen";
import MultisigCreateScreen from "@/screens/multisig/multisig-create-screen";
import MultisigDetailScreen from "@/screens/multisig/multisig-detail-screen";
import MultisigDepositScreen from "@/screens/multisig/multisig-deposit-screen";
import MultisigReleaseScreen from "@/screens/multisig/multisig-release-screen";
import MultisigApprovalsScreen from "@/screens/multisig/multisig-approvals-screen";
import MultisigApprovalScreen from "@/screens/multisig/multisig-approval-screen";
import ReceiveScreen from "@/screens/receive/receive-screen";
import HistoryScreen from "@/screens/history/history-screen";
import TxDetailScreen from "@/screens/history/tx-detail-screen";
import ContactsScreen from "@/screens/contacts/contacts-screen";
import ContactEditorScreen from "@/screens/contacts/contact-editor-screen";
import ContactsTransferScreen from "@/screens/contacts/contacts-transfer-screen";
import SearchScreen from "@/screens/search/search-screen";
import RequestScreen from "@/screens/request/request-screen";
import SettingsScreen from "@/screens/settings/settings-screen";
import RequestHistoryScreen from "@/screens/settings/request-history-screen";
import RequestHistoryDetailScreen from "@/screens/settings/request-history-detail-screen";
import SecurityScreen from "@/screens/settings/security-screen";
import AuditLogScreen from "@/screens/settings/audit-log-screen";
import NetworkScreen from "@/screens/settings/network-screen";
import NotificationsScreen from "@/screens/settings/notifications-screen";
import DiagnosticsScreen from "@/screens/settings/diagnostics-screen";
import AppearanceScreen from "@/screens/settings/appearance-screen";

function Screen({ component: C }: { component: ComponentType }) {
  return (
    <ErrorBoundary>
      <C />
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
          { path: "/accounts/export", element: <Screen component={AccountExportScreen} /> },
          { path: "/accounts/:index", element: <Screen component={AccountDetailScreen} /> },
          { path: "/send", element: <Screen component={SendScreen} /> },
          { path: "/send/scheduled", element: <Screen component={ScheduledTransfersScreen} /> },
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
