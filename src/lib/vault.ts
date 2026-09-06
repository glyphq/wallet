import { invoke } from "@tauri-apps/api/core";
import {
  generateSeed,
  toSeed,
  validateSeed,
  exportVault,
  importVault,
  WalletError,
  VaultDecryptionError,
  InvalidVaultError,
} from "@qubic.org/wallet";
import type { Seed } from "@qubic.org/types";
import type { VaultData } from "@qubic.org/wallet";
import type { SessionWallet } from "@/lib/session-wallet";

export {
  generateSeed,
  toSeed,
  validateSeed,
  exportVault,
  importVault,
  WalletError,
  VaultDecryptionError,
  InvalidVaultError,
};

export type {
  VaultData,
};

export async function createVault(password: string, seeds: Seed[]): Promise<VaultData> {
  return invoke<VaultData>("encrypt_vault", {
    password,
    seeds: [...seeds],
  });
}

interface NativeSessionWallet {
  identity: string;
  publicKey: number[];
}

export async function unlockVaultSession(vaultData: VaultData, password: string): Promise<SessionWallet[]> {
  const wallets = await invoke<NativeSessionWallet[]>("unlock_vault_session", {
    vaultData,
    password,
  });
  return wallets.map((wallet) => ({
    identity: wallet.identity,
    publicKey: new Uint8Array(wallet.publicKey),
  }));
}

export async function verifyVaultPassword(vaultData: VaultData, password: string): Promise<void> {
  await invoke("verify_vault_password", { vaultData, password });
}

// Serialize vault mutations so concurrent add-account calls cannot interleave
// decrypt→re-encrypt steps and silently overwrite each other.
let _vaultMutex = Promise.resolve();

export function addToVault(vaultData: VaultData, password: string, seed: Seed): Promise<VaultData> {
  const result = _vaultMutex.then(() =>
    invoke<VaultData>("add_seed_to_vault", { vaultData, password, seed: String(seed) })
  );
  _vaultMutex = result.then(() => {}, () => {});
  return result;
}

export function removeFromVault(vaultData: VaultData, password: string, index: number): Promise<VaultData> {
  const result = _vaultMutex.then(() =>
    invoke<VaultData>("remove_seed_from_vault", { vaultData, password, index })
  );
  _vaultMutex = result.then(() => {}, () => {});
  return result;
}

export async function rotateVaultPassword(
  vaultData: VaultData,
  oldPassword: string,
  newPassword: string,
): Promise<VaultData> {
  return invoke<VaultData>("rotate_vault_password", { vaultData, oldPassword, newPassword });
}

export async function selectVaultAccounts(
  vaultData: VaultData,
  password: string,
  indices: number[],
): Promise<VaultData> {
  return invoke<VaultData>("select_vault_accounts", { vaultData, password, indices });
}

/** Explicit seed reveal is the only operation intentionally returning a seed to the renderer. */
export async function revealVaultSeed(
  vaultData: VaultData,
  password: string,
  accountIndex: number,
): Promise<Seed> {
  return invoke<Seed>("reveal_vault_seed", { vaultData, password, accountIndex });
}
