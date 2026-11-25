import { newId } from "@/lib/crypto";
import { sumQuAmounts } from "./send-flow";

export const MAX_RECIPIENTS = 25;

export interface Recipient {
  id: string;
  identity: string;
  amount: string;
  identityError: string;
  amountError: string;
}

export function emptyRecipient(): Recipient {
  return { id: newId(), identity: "", amount: "", identityError: "", amountError: "" };
}

/** Sum of all positive recipient amounts (unparsable entries ignored). */
export function sumRecipientAmounts(recipients: readonly Recipient[]): bigint {
  return sumQuAmounts(recipients.map((recipient) => recipient.amount));
}
