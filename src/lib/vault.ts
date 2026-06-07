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

export async function unlockVault(vaultData: VaultData, password: string): Promise<Seed[]> {
  return invoke<Seed[]>("decrypt_vault", {
    vaultData,
    password,
  });
}

// Serialize vault mutations so concurrent add-account calls cannot interleave
// decrypt→re-encrypt steps and silently overwrite each other.
let _vaultMutex = Promise.resolve();

export function addToVault(vaultData: VaultData, password: string, seed: Seed): Promise<VaultData> {
  const result = _vaultMutex.then(async () => {
    const seeds = await unlockVault(vaultData, password);
    return createVault(password, [...seeds, seed]);
  });
  _vaultMutex = result.then(() => {}, () => {});
  return result;
}

export function removeFromVault(vaultData: VaultData, password: string, index: number): Promise<VaultData> {
  const result = _vaultMutex.then(async () => {
    const seeds = await unlockVault(vaultData, password);
    return createVault(password, seeds.filter((_, i) => i !== index));
  });
  _vaultMutex = result.then(() => {}, () => {});
  return result;
}
