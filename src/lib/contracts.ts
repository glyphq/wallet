import { contractIndexToIdentity } from "@qubic.org/crypto";
import * as contractPkg from "@qubic.org/contracts";
import {
  Q_UTIL_CONTRACT_INDEX,
  Q_UTIL_SEND_TO_MANY_V1_INPUT_TYPE,
  Q_UTIL_BURN_QUBIC_INPUT_TYPE,
  buildQUtilBurnQubicInput,
  qUtilGetSendToManyV1Fee,
  QEARN_CONTRACT_INDEX,
  QEARN_LOCK_INPUT_TYPE,
  MS_VAULT_CONTRACT_INDEX,
  MS_VAULT_DEPOSIT_INPUT_TYPE,
  MS_VAULT_RELEASE_TO_INPUT_TYPE,
  MS_VAULT_RESET_RELEASE_INPUT_TYPE,
  buildQearnUnlockInput,
  qearnGetUserLockStatus,
  qearnGetUserLockedInfo,
  qearnGetLockInfoPerEpoch,
} from "@qubic.org/contracts";

export type { ContractCall } from "@qubic.org/contracts";

export {
  Q_UTIL_CONTRACT_INDEX,
  Q_UTIL_SEND_TO_MANY_V1_INPUT_TYPE,
  Q_UTIL_BURN_QUBIC_INPUT_TYPE,
  buildQUtilBurnQubicInput,
  qUtilGetSendToManyV1Fee,
  QEARN_CONTRACT_INDEX,
  QEARN_LOCK_INPUT_TYPE,
  MS_VAULT_CONTRACT_INDEX,
  MS_VAULT_DEPOSIT_INPUT_TYPE,
  MS_VAULT_RELEASE_TO_INPUT_TYPE,
  MS_VAULT_RESET_RELEASE_INPUT_TYPE,
  buildQearnUnlockInput,
  qearnGetUserLockStatus,
  qearnGetUserLockedInfo,
  qearnGetLockInfoPerEpoch,
};

// Human-readable names keyed by the camelCase namespace export (tree-shake safe).
const NAMESPACE_TO_NAME: Record<string, string> = {
  computorControlledFund: "Computor Controlled Fund",
  escrow: "Escrow",
  generalQuorumProposal: "General Quorum Proposal",
  msVault: "MS Vault",
  myLastMatch: "My Last Match",
  nostromo: "Nostromo",
  pulse: "Pulse",
  qBond: "Q-Bond",
  qDuel: "Q-Duel",
  qIP: "QIP",
  qRWA: "Q-RWA",
  qRaffle: "Q-Raffle",
  qReservePool: "Q Reserve Pool",
  qThirtyFour: "Q34",
  qUtil: "QUtil",
  qVAULT: "QVault",
  qbay: "Qbay",
  qdraw: "Qdraw",
  qearn: "Qearn",
  qswap: "Qswap",
  quottery: "Quottery",
  qusino: "Qusino",
  qx: "QX",
  random: "Random",
  randomLottery: "Random Lottery",
  supplyWatcher: "Supply Watcher",
  vottunBridge: "Vottun Bridge",
};

function toTitleCase(s: string): string {
  return s.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

// Build lookup maps from all @qubic.org/contracts exports at module init time.
export const CONTRACT_NAMES: Record<number, string> = {};
export const CONTRACT_PROCEDURE_NAMES: Record<string, string> = {};

const prefixToIndex: Record<string, number> = {};

// CONTRACT_NAMES: use namespace objects (always exported regardless of tree-shaking).
for (const [key, value] of Object.entries(contractPkg)) {
  if (typeof value !== "object" || value === null || typeof (value as Record<string, unknown>).contractIndex !== "number") continue;
  const contractIndex = (value as Record<string, unknown>).contractIndex as number;
  CONTRACT_NAMES[contractIndex] = NAMESPACE_TO_NAME[key] ?? key;
}

// prefixToIndex: built from _CONTRACT_INDEX exports available in the pre-bundle.
for (const [key, value] of Object.entries(contractPkg)) {
  if (typeof value !== "number" || !key.endsWith("_CONTRACT_INDEX")) continue;
  prefixToIndex[key.slice(0, -"_CONTRACT_INDEX".length)] = value;
}

// Build set of valid write procedures from build*Input methods on namespace objects.
// This distinguishes callable SC procedures from read-only query functions, which can
// share the same numeric inputType value in separate call paths.
const validProcedures = new Set<string>(); // "contractIndex:PROC_SCREAMING_CASE"
for (const [, nsValue] of Object.entries(contractPkg)) {
  if (typeof nsValue !== "object" || nsValue === null) continue;
  const rec = nsValue as Record<string, unknown>;
  if (typeof rec.contractIndex !== "number") continue;
  const idx = rec.contractIndex as number;
  for (const methodKey of Object.keys(rec)) {
    if (!methodKey.startsWith("build") || !methodKey.endsWith("Input")) continue;
    const camel = methodKey.slice("build".length, -"Input".length);
    const screaming = camel.replace(/([A-Z])/g, "_$1").toUpperCase().replace(/^_/, "");
    validProcedures.add(`${idx}:${screaming}`);
  }
}

// CONTRACT_PROCEDURE_NAMES: only emit entries for confirmed write procedures.
for (const [key, value] of Object.entries(contractPkg)) {
  if (typeof value !== "number" || !key.endsWith("_INPUT_TYPE")) continue;
  let bestPrefix = "";
  for (const prefix of Object.keys(prefixToIndex)) {
    if (key.startsWith(prefix + "_") && prefix.length > bestPrefix.length) bestPrefix = prefix;
  }
  if (!bestPrefix) continue;
  const contractIdx = prefixToIndex[bestPrefix];
  const proc = key.slice(bestPrefix.length + 1, -"_INPUT_TYPE".length);
  if (!validProcedures.has(`${contractIdx}:${proc}`)) continue;
  const compositeKey = `${contractIdx}:${value}`;
  if (CONTRACT_PROCEDURE_NAMES[compositeKey]) continue;
  CONTRACT_PROCEDURE_NAMES[compositeKey] = toTitleCase(proc);
}

// Qearn lock (inputType=1) is a real SC procedure but lacks a buildLockInput helper.
CONTRACT_PROCEDURE_NAMES[`${QEARN_CONTRACT_INDEX}:1`] ??= "Lock";

// Pre-computed contract destination identities.
export const QUTIL_ADDRESS = contractIndexToIdentity(Q_UTIL_CONTRACT_INDEX);
export const QEARN_ADDRESS = contractIndexToIdentity(QEARN_CONTRACT_INDEX);

// Build full known-addresses map from all contract indices.
export const KNOWN_CONTRACT_ADDRESSES: Record<string, string> = {};
for (const [idx, name] of Object.entries(CONTRACT_NAMES)) {
  KNOWN_CONTRACT_ADDRESSES[contractIndexToIdentity(Number(idx)) as string] = name;
}
