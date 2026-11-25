import { CONTRACT_NAMES, CONTRACT_PROCEDURE_NAMES } from "@/lib/contracts";
import { notificationAddress, contractPhrase, notificationAmount } from "@/lib/notification-copy";
import type { GlyphRequest } from "./request-schema-requests";

function parseQuAmount(value: unknown): bigint | null {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) return BigInt(value);
    if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  } catch {
    return null;
  }
  return null;
}

function requester(input: GlyphRequest): string {
  return input.dapp.name?.trim() || "A decentralized application";
}

export function buildRequestNotification(input: GlyphRequest): { title: string; body: string } | null {
  const title = input.dapp.name?.trim()
    ? `Request from ${input.dapp.name.trim()}`
    : "Request waiting for review";

  switch (input.type) {
    case "transfer": {
      const amount = parseQuAmount(input.amount);
      return {
        title,
        body: amount !== null
          ? `${requester(input)} is requesting a transfer of ${notificationAmount(amount)} to ${notificationAddress(input.to)}.`
          : `${requester(input)} is requesting a transfer to ${notificationAddress(input.to)}.`,
      };
    }
    case "sc_call": {
      const amount = parseQuAmount(input.amount);
      const contractName = CONTRACT_NAMES[input.contract_index] ?? `Contract #${input.contract_index}`;
      const procedureName = CONTRACT_PROCEDURE_NAMES[`${input.contract_index}:${input.input_type}`] ?? null;
      const label = procedureName ? `${contractName} · ${procedureName}` : contractName;
      return {
        title,
        body: amount !== null && amount > 0n
          ? `${requester(input)} is requesting a ${contractPhrase(label)} call with ${notificationAmount(amount)} attached.`
          : `${requester(input)} is requesting a ${contractPhrase(label)} call.`,
      };
    }
    case "sign_message":
      return { title, body: `${requester(input)} is asking you to sign a message.` };
    case "verify_message":
      return { title, body: `${requester(input)} is asking you to verify a signature.` };
    case "connect":
      return { title, body: `${requester(input)} wants to connect to your wallet.` };
    default:
      return null;
  }
}
