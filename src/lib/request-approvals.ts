import type { GlyphPermission } from "@/lib/request-schema";

/** Result of approving a reviewed transfer request. */
export interface ApproveResult {
  txHash: string;
  targetTick: number;
  identity: string;
  accountIndex: number;
}

/** Result of approving a reviewed message-signing request. */
export interface SignMessageApproveResult {
  signature: string; // base64-encoded 64-byte SchnorrQ signature
  publicKey: string; // base64-encoded 32-byte public key
  identity: string;
  accountIndex: number;
}

/** Result of approving a reviewed dApp connection request. */
export interface ConnectApproveResult {
  identity: string;
  accountIndex: number;
  /** Echoed to the dApp for wire compatibility; the wallet reviews every action. */
  permissions: GlyphPermission[];
}

/** Result of verifying a message signature in the review UI. */
export interface VerifyMessageResult {
  valid: boolean;
  identity: string;
  accountIndex: number;
}
