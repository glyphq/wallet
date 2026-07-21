import type { ComponentType } from "react";
import type { IconProps } from "@solar-icons/react";
import {
  Buildings,
  Compass,
  Document,
  FolderOpen,
  HomeSmile,
  Key,
  Planet,
  Rocket,
  Safe2,
  ShieldCheck,
  Star,
  UserRounded,
  UsersGroupRounded,
  Wallet,
  WalletMoney,
} from "@solar-icons/react";
import type { VaultColor, WalletIconId } from "@/store/persisted";

export const DEFAULT_WALLET_ICON: WalletIconId = "wallet";
export const DEFAULT_WALLET_COLOR: VaultColor = "slate";

type WalletIconOption = {
  id: WalletIconId;
  label: string;
  Icon: ComponentType<IconProps>;
};

export const WALLET_ICON_OPTIONS: WalletIconOption[] = [
  { id: "wallet", label: "Wallet", Icon: Wallet },
  { id: "wallet-money", label: "Cash", Icon: WalletMoney },
  { id: "safe", label: "Safe", Icon: Safe2 },
  { id: "shield", label: "Shield", Icon: ShieldCheck },
  { id: "folder", label: "Folder", Icon: FolderOpen },
  { id: "home", label: "Home", Icon: HomeSmile },
  { id: "buildings", label: "City", Icon: Buildings },
  { id: "compass", label: "Compass", Icon: Compass },
  { id: "star", label: "Star", Icon: Star },
  { id: "rocket", label: "Rocket", Icon: Rocket },
  { id: "planet", label: "Planet", Icon: Planet },
  { id: "key", label: "Key", Icon: Key },
];

export const WALLET_COLOR_OPTIONS: { id: VaultColor; label: string; accent: string }[] = [
  { id: "slate", label: "Accent", accent: "var(--color-wallet-accent-slate)" },
  { id: "sky", label: "Sky", accent: "var(--color-wallet-accent-sky)" },
  { id: "emerald", label: "Emerald", accent: "var(--color-wallet-accent-emerald)" },
  { id: "amber", label: "Amber", accent: "var(--color-wallet-accent-amber)" },
  { id: "violet", label: "Violet", accent: "var(--color-wallet-accent-violet)" },
  { id: "red", label: "Red", accent: "var(--color-wallet-accent-red)" },
];

export function getWalletIconComponent(icon?: WalletIconId) {
  return WALLET_ICON_OPTIONS.find((option) => option.id === icon)?.Icon ?? Wallet;
}

export function getWalletIconLabel(icon?: WalletIconId) {
  return WALLET_ICON_OPTIONS.find((option) => option.id === icon)?.label ?? "Wallet";
}

export function getWalletAccent(color?: VaultColor) {
  return WALLET_COLOR_OPTIONS.find((option) => option.id === color)?.accent ?? "var(--color-wallet-accent-slate)";
}

export const PERSONA_ICON = UserRounded;
export const CONTACT_ICON = UsersGroupRounded;
export const CONTRACT_ICON = Document;
