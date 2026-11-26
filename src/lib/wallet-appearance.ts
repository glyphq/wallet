import type { ComponentType } from "react";
import type { IconProps } from "@/lib/icons";
import {
  Building01Icon,
  Compass01Icon,
  FolderOpenIcon,
  Home01Icon,
  Key01Icon,
  GlobalIcon,
  Rocket01Icon,
  SafeIcon,
  ShieldCheckIcon,
  StarIcon,
  UserGroupIcon,
  Wallet01Icon,
  WalletAdd01Icon,
} from "@/lib/icons";
import type { WalletColor, WalletIconId } from "@/store/persisted";

export const DEFAULT_WALLET_ICON: WalletIconId = "wallet";
export const DEFAULT_WALLET_COLOR: WalletColor = "slate";

type WalletIconOption = {
  id: WalletIconId;
  label: string;
  Icon: ComponentType<IconProps>;
};

export const WALLET_ICON_OPTIONS: WalletIconOption[] = [
  { id: "wallet", label: "Wallet", Icon: Wallet01Icon },
  { id: "wallet-money", label: "Cash", Icon: WalletAdd01Icon },
  { id: "safe", label: "Safe", Icon: SafeIcon },
  { id: "shield", label: "Shield", Icon: ShieldCheckIcon },
  { id: "folder", label: "Folder", Icon: FolderOpenIcon },
  { id: "home", label: "Home", Icon: Home01Icon },
  { id: "buildings", label: "City", Icon: Building01Icon },
  { id: "compass", label: "Compass", Icon: Compass01Icon },
  { id: "star", label: "Star", Icon: StarIcon },
  { id: "rocket", label: "Rocket", Icon: Rocket01Icon },
  { id: "planet", label: "Globe", Icon: GlobalIcon },
  { id: "key", label: "Key", Icon: Key01Icon },
];

export const WALLET_COLOR_OPTIONS: { id: WalletColor; label: string; accent: string }[] = [
  { id: "slate", label: "Accent", accent: "var(--color-wallet-accent-slate)" },
  { id: "sky", label: "Sky", accent: "var(--color-wallet-accent-sky)" },
  { id: "emerald", label: "Emerald", accent: "var(--color-wallet-accent-emerald)" },
  { id: "amber", label: "Amber", accent: "var(--color-wallet-accent-amber)" },
  { id: "violet", label: "Violet", accent: "var(--color-wallet-accent-violet)" },
  { id: "red", label: "Red", accent: "var(--color-wallet-accent-red)" },
];

export function getWalletIconComponent(icon?: WalletIconId) {
  return WALLET_ICON_OPTIONS.find((option) => option.id === icon)?.Icon ?? Wallet01Icon;
}

export function getWalletIconLabel(icon?: WalletIconId) {
  return WALLET_ICON_OPTIONS.find((option) => option.id === icon)?.label ?? "Wallet";
}

export function getWalletAccent(color?: WalletColor) {
  return WALLET_COLOR_OPTIONS.find((option) => option.id === color)?.accent ?? "var(--color-wallet-accent-slate)";
}

export const CONTACT_ICON = UserGroupIcon;
