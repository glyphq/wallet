import { isValidIdentity } from "@/lib/crypto";
import sponsorNames from "../../sponsor-names.json";

export interface Sponsor {
  identity: string;
  name: string;
  amount: bigint; // QU contributed
}

export interface SponsorDonation {
  hash: string;
  source: string;
  amount: bigint;
  timestamp: number | null;
}

export interface SponsorTransparencyData {
  sponsors: Sponsor[];
  donations: SponsorDonation[];
  latestContributors: Sponsor[];
}

/** Qubic identity that receives donation QU for Sigil development. */
export const DONATION_IDENTITY =
  "SIGILZXQNLOTDENBWIBTOGRNBPLBWISKLZCQQFMEECEKOTNVJMMGRWYALYQL";

if (!isValidIdentity(DONATION_IDENTITY)) {
  throw new Error(`[sigil] DONATION_IDENTITY is not a valid Qubic address: ${DONATION_IDENTITY}`);
}

export const SPONSOR_NAMES = sponsorNames as Record<string, string>;
