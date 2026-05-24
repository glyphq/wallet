import { isValidIdentity } from "@/lib/crypto";
import sponsorNames from "../../sponsor-names.json";

export interface Sponsor {
  name: string;
  amount: bigint; // QU contributed
}

/** Qubic identity that receives donation QU for Sigil development. */
export const DONATION_IDENTITY =
  "UVYAOYTNYCRBVFBHNFIJUEOUEPEDIDUWWEAXKFSJEBJVASCQEROJOVOEEATL";

if (!isValidIdentity(DONATION_IDENTITY)) {
  throw new Error(`[sigil] DONATION_IDENTITY is not a valid Qubic address: ${DONATION_IDENTITY}`);
}

export const SPONSOR_NAMES = sponsorNames as Record<string, string>;
