import { createHashRouter } from "react-router-dom";
import { AnimatedLayout } from "@/layouts/animated-layout";

import RootScreen from "@/screens/root-screen";
import LockScreen from "@/screens/lock/lock-screen";
import WelcomeScreen from "@/screens/setup/welcome-screen";
import CreateVaultScreen from "@/screens/setup/create-vault-screen";
import ImportVaultScreen from "@/screens/setup/import-vault-screen";
import DashboardScreen from "@/screens/dashboard/dashboard-screen";
import VaultsScreen from "@/screens/vaults/vaults-screen";
import VaultDetailScreen from "@/screens/vaults/vault-detail-screen";
import SendScreen from "@/screens/send/send-screen";
import SendManyScreen from "@/screens/send/send-many-screen";
import BurnScreen from "@/screens/send/burn-screen";
import StakeScreen from "@/screens/stake/stake-screen";
import ReceiveScreen from "@/screens/receive/receive-screen";
import HistoryScreen from "@/screens/history/history-screen";
import ContactsScreen from "@/screens/contacts/contacts-screen";
import RequestScreen from "@/screens/request/request-screen";
import SettingsScreen from "@/screens/settings/settings-screen";
import DappsScreen from "@/screens/settings/dapps-screen";
import SecurityScreen from "@/screens/settings/security-screen";
import NetworkScreen from "@/screens/settings/network-screen";
import AppearanceScreen from "@/screens/settings/appearance-screen";
import SettingsContactsScreen from "@/screens/settings/contacts-screen";
import NotificationsScreen from "@/screens/settings/notifications-screen";
import SupportScreen from "@/screens/settings/support-screen";

export const router = createHashRouter([
  {
    element: <AnimatedLayout />,
    children: [
      { path: "/", element: <RootScreen /> },
      { path: "/lock", element: <LockScreen /> },
      { path: "/setup", element: <WelcomeScreen /> },
      { path: "/setup/create", element: <CreateVaultScreen /> },
      { path: "/setup/import", element: <ImportVaultScreen /> },
      { path: "/dashboard", element: <DashboardScreen /> },
      { path: "/vaults", element: <VaultsScreen /> },
      { path: "/vaults/:id", element: <VaultDetailScreen /> },
      { path: "/send", element: <SendScreen /> },
      { path: "/send-many", element: <SendManyScreen /> },
      { path: "/burn", element: <BurnScreen /> },
      { path: "/stake", element: <StakeScreen /> },
      { path: "/receive", element: <ReceiveScreen /> },
      { path: "/history", element: <HistoryScreen /> },
      { path: "/contacts", element: <ContactsScreen /> },
      { path: "/request", element: <RequestScreen /> },
      { path: "/settings", element: <SettingsScreen /> },
      { path: "/settings/dapps", element: <DappsScreen /> },
      { path: "/settings/security", element: <SecurityScreen /> },
      { path: "/settings/network", element: <NetworkScreen /> },
      { path: "/settings/appearance", element: <AppearanceScreen /> },
      { path: "/settings/contacts", element: <SettingsContactsScreen /> },
      { path: "/settings/notifications", element: <NotificationsScreen /> },
      { path: "/settings/support", element: <SupportScreen /> },
    ],
  },
]);
