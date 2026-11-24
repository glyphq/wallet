import {
  CONTRACT_HANDLES,
  CONTRACTS_BY_INDEX,
  MSVAULT,
  QEARN,
  QUTIL,
  QX,
  decodeFields,
  getProcedure,
  type ContractCall,
  type DecodedStruct,
} from "@glyph-oss/contracts";

/** Display names differ from the canonical on-chain contract names. */
const CONTRACT_DISPLAY_NAMES: Record<string, string> = {
  CCF: "Computor Controlled Fund",
  ESCROW: "Escrow",
  GQMPROP: "General Quorum Proposal",
  MLM: "MLM",
  MSVAULT: "MS Vault",
  NOST: "Nostromo",
  PULSE: "Pulse",
  QBAY: "Qbay",
  QBOND: "Q-Bond",
  QDRAW: "Qdraw",
  QDUEL: "Q-Duel",
  QEARN: "Qearn",
  QIP: "QIP",
  QPAYHUB: "QPayHub",
  QPUMP: "QPump",
  QRAFFLE: "Q-Raffle",
  QRP: "Q Reserve Pool",
  QRWA: "Q-RWA",
  QSWAP: "Qswap",
  QTREAT: "QTreat",
  QTF: "Q34",
  QUOTTERY: "Quottery",
  QUSINO: "Qusino",
  QUTIL: "QUtil",
  QVAULT: "QVault",
  QX: "QX",
  RANDOM: "Random",
  RL: "Random Lottery",
  SWATCH: "Supply Watcher",
  VOTTUNBRIDGE: "Vottun Bridge",
  WOLFPACK: "Wolfpack",
};

function displayName(canonical: string): string {
  return CONTRACT_DISPLAY_NAMES[canonical] ?? canonical;
}

function callLabel(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function inputTypeOf(call: ContractCall): number {
  if (call.inputType == null) {
    throw new Error(`Contract call "${call.name}" has no input type`);
  }
  return call.inputType;
}

export const CONTRACT_NAMES: Record<number, string> = {};
export const CONTRACT_PROCEDURE_NAMES: Record<string, string> = {};
export const KNOWN_CONTRACT_ADDRESSES: Record<string, string> = {};

for (const handle of CONTRACT_HANDLES) {
  const name = displayName(handle.name);
  CONTRACT_NAMES[handle.contractIndex] = name;
  KNOWN_CONTRACT_ADDRESSES[handle.contractAddress] = name;

  for (const call of Object.values(handle.procedures)) {
    if (call.inputType == null) continue;
    CONTRACT_PROCEDURE_NAMES[`${handle.contractIndex}:${call.inputType}`] ??= callLabel(call.name);
  }
}

const CONTRACT_INDEX_BY_NAME: Record<string, number> = {};
for (const [index, name] of Object.entries(CONTRACT_NAMES)) {
  CONTRACT_INDEX_BY_NAME[name] ??= Number(index);
}

/** Resolves the human-readable procedure for a contract transaction, if known. */
export function resolveProcedureName(
  contractName: string | undefined,
  fromContract: string | undefined,
  inputType: number | null | undefined,
): string | undefined {
  const scName = contractName ?? fromContract;
  const contractIndex = scName ? CONTRACT_INDEX_BY_NAME[scName] : undefined;
  if (contractIndex === undefined || inputType == null) return undefined;
  return CONTRACT_PROCEDURE_NAMES[`${contractIndex}:${inputType}`];
}

// QUTIL
export const QUTIL_CONTRACT_INDEX = QUTIL.contractIndex;
export const QUTIL_ADDRESS = QUTIL.contractAddress;
export const QUTIL_SEND_TO_MANY_V1_INPUT_TYPE = inputTypeOf(QUTIL.procedures.SendToManyV1!);
export const QUTIL_BURN_QUBIC_INPUT_TYPE = inputTypeOf(QUTIL.procedures.BurnQubic!);

// QEARN
export const QEARN_CONTRACT_INDEX = QEARN.contractIndex;
export const QEARN_ADDRESS = QEARN.contractAddress;
export const QEARN_LOCK_INPUT_TYPE = inputTypeOf(QEARN.procedures.lock!);
export const QEARN_UNLOCK_INPUT_TYPE = inputTypeOf(QEARN.procedures.unlock!);

// QX
export const QX_CONTRACT_INDEX = QX.contractIndex;
export const QX_ADDRESS = QX.contractAddress;
export const QX_TRANSFER_SHARE_MANAGEMENT_RIGHTS_INPUT_TYPE = inputTypeOf(
  QX.procedures.TransferShareManagementRights!,
);

// MSVAULT
export const MSVAULT_CONTRACT_INDEX = MSVAULT.contractIndex;
export const MSVAULT_ADDRESS = MSVAULT.contractAddress;
export const MSVAULT_REGISTER_INPUT_TYPE = inputTypeOf(MSVAULT.procedures.registerVault!);
export const MSVAULT_DEPOSIT_INPUT_TYPE = inputTypeOf(MSVAULT.procedures.deposit!);
export const MSVAULT_RELEASE_TO_INPUT_TYPE = inputTypeOf(MSVAULT.procedures.releaseTo!);
export const MSVAULT_RESET_RELEASE_INPUT_TYPE = inputTypeOf(MSVAULT.procedures.resetRelease!);
export const MSVAULT_DEPOSIT_ASSET_INPUT_TYPE = inputTypeOf(MSVAULT.procedures.depositAsset!);
export const MSVAULT_RELEASE_ASSET_TO_INPUT_TYPE = inputTypeOf(MSVAULT.procedures.releaseAssetTo!);
export const MSVAULT_RESET_ASSET_RELEASE_INPUT_TYPE = inputTypeOf(
  MSVAULT.procedures.resetAssetRelease!,
);
export const MSVAULT_REVOKE_ASSET_MANAGEMENT_RIGHTS_INPUT_TYPE = inputTypeOf(
  MSVAULT.procedures.revokeAssetManagementRights!,
);

export { MSVAULT, QEARN, QUTIL, QX };

/** Decode a procedure payload into its declared input fields, when the ABI knows the call. */
export function decodeProcedureInputValues(
  contractIndex: number,
  inputType: number,
  payload: Uint8Array,
): DecodedStruct | null {
  const contract = CONTRACTS_BY_INDEX[contractIndex];
  if (!contract) return null;
  try {
    const call = getProcedure(contract, inputType);
    return decodeFields(payload, call.inputFields, contract, { idFormat: "identity" });
  } catch {
    return null;
  }
}
