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

export function buildRequestNotification(input: GlyphRequest): { title: string; body: string } | null {
  switch (input.type) {
    case "transfer": {
      const amount = parseQuAmount(input.amount);
      return {
        title: "Request waiting for review",
        body: amount !== null
          ? `A transfer request for ${notificationAmount(amount)} to ${notificationAddress(input.to)} is waiting for your review.`
          : `A transfer request to ${notificationAddress(input.to)} is waiting for your review.`,
      };
    }
    case "sc_call": {
      const amount = parseQuAmount(input.amount);
      const contractName = CONTRACT_NAMES[input.contract_index] ?? `Contract #${input.contract_index}`;
      const procedureName = CONTRACT_PROCEDURE_NAMES[`${input.contract_index}:${input.input_type}`] ?? null;
      const label = procedureName ? `${contractName} · ${procedureName}` : contractName;
      return {
        title: "Request waiting for review",
        body: amount !== null && amount > 0n
          ? `A request to call ${contractPhrase(label)} for ${notificationAmount(amount)} is waiting for your review.`
          : `A request to call ${contractPhrase(label)} is waiting for your review.`,
      };
    }
    case "sign_message":
      return { title: "Request waiting for review", body: "A request to sign a message is waiting for your review." };
    case "verify_message":
      return { title: "Request waiting for review", body: "A request to verify a signature is waiting for your review." };
    case "connect":
      return { title: "Request waiting for review", body: "A request to connect to a decentralized application is waiting for your review." };
    default:
      return null;
  }
}
