export interface Sponsor {
  name: string;
  amount: number; // QU contributed
}

export const DONATION_IDENTITY =
  "UVYAOYTNYCRBVFBHNFIJUEOUEPEDIDUWWEAXKFSJEBJVASCQEROJOVOEEATL";

// Identity → display name overrides, committed to the repo.
// Fetched at runtime so a merged PR reflects immediately without a rebuild.
export const SPONSOR_NAMES_URL =
  "https://raw.githubusercontent.com/sigil-oss/sigil.app/main/sponsor-names.json";
