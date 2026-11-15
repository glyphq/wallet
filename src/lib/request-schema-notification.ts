import { CONTRACT_NAMES, CONTRACT_PROCEDURE_NAMES } from "@/lib/contracts";
import { truncateIdentity } from "@/lib/crypto";
import { formatQu } from "@/lib/format";
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
      const to = truncateIdentity(input.to);
      return {
        title: "Request Waiting For Review",
        body: amount !== null ? `Transfer ${formatQu(amount)} QU to ${to}.` : `Transfer QU to ${to}.`,
      };
    }
    case "sc_call": {
      const amount = parseQuAmount(input.amount);
      const contractName = CONTRACT_NAMES[input.contract_index] ?? `Contract #${input.contract_index}`;
      const procedureName = CONTRACT_PROCEDURE_NAMES[`${input.contract_index}:${input.input_type}`] ?? null;
      const label = procedureName ? `${contractName} · ${procedureName}` : contractName;
      return {
        title: "Request Waiting For Review",
        body: amount !== null && amount > 0n ? `Contract call: ${label} for ${formatQu(amount)} QU.` : `Contract call: ${label}.`,
      };
    }
    case "sign_message":
      return { title: "Request Waiting For Review", body: "Message signing request received." };
    case "verify_message":
      return { title: "Request Waiting For Review", body: "Signature verification request received." };
    case "connect":
      return { title: "Request Waiting For Review", body: "Connection request received." };
    default:
      return null;
  }
}
