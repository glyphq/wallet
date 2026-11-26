import { invoke } from "@tauri-apps/api/core";
import { exportVault as exportWallet } from "@qubic.org/wallet";
import type { Seed } from "@qubic.org/types";
import type { VaultData as WalletData } from "@qubic.org/wallet";
import type { SessionAccount } from "@/lib/session-account";

export { exportWallet };

export type {
  WalletData,
};

export async function createWallet(password: string, seeds: Seed[]): Promise<WalletData> {
  return invoke<WalletData>("encrypt_wallet", {
    password,
    seeds: [...seeds],
  });
}

interface NativeSessionAccount {
  identity: string;
  publicKey: number[];
}

function toSessionAccounts(wallets: NativeSessionAccount[]): SessionAccount[] {
  return wallets.map((wallet) => ({
    identity: wallet.identity,
    publicKey: new Uint8Array(wallet.publicKey),
  }));
}

export async function unlockWalletSession(walletData: WalletData, password: string): Promise<SessionAccount[]> {
  const wallets = await invoke<NativeSessionAccount[]>("unlock_wallet_session", {
    walletData,
    password,
  });
  return toSessionAccounts(wallets);
}

/** Native biometric unlock returns canonical public wallet metadata, never seed positions. */
export async function unlockBiometricSession(walletId: string, walletData: WalletData): Promise<SessionAccount[]> {
  const wallets = await invoke<NativeSessionAccount[]>("biometric_unlock", { walletId, walletData });
  return toSessionAccounts(wallets);
}

export async function verifyWalletPassword(walletData: WalletData, password: string): Promise<void> {
  await invoke("verify_wallet_password", { walletData, password });
}

// Serialize wallet mutations so concurrent add-account calls cannot interleave
// decrypt→re-encrypt steps and silently overwrite each other.
let _walletMutex = Promise.resolve();

export function addToWallet(walletData: WalletData, password: string, seed: Seed): Promise<WalletData> {
  const result = _walletMutex.then(() =>
    invoke<WalletData>("add_seed_to_wallet", { walletData, password, seed: String(seed) })
  );
  _walletMutex = result.then(() => {}, () => {});
  return result;
}

export function removeFromWallet(walletData: WalletData, password: string, index: number): Promise<WalletData> {
  const result = _walletMutex.then(() =>
    invoke<WalletData>("remove_seed_from_wallet", { walletData, password, index })
  );
  _walletMutex = result.then(() => {}, () => {});
  return result;
}

export async function rotateWalletPassword(
  walletData: WalletData,
  oldPassword: string,
  newPassword: string,
): Promise<WalletData> {
  return invoke<WalletData>("rotate_wallet_password", { walletData, oldPassword, newPassword });
}

export async function selectWalletAccounts(
  walletData: WalletData,
  password: string,
  indices: number[],
): Promise<WalletData> {
  return invoke<WalletData>("select_wallet_accounts", { walletData, password, indices });
}

/** Explicit seed reveal is the only operation intentionally returning a seed to the renderer. */
export async function revealWalletSeed(
  walletData: WalletData,
  password: string,
  accountIndex: number,
): Promise<Seed> {
  return invoke<Seed>("reveal_wallet_seed", { walletData, password, accountIndex });
}
