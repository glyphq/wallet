import type { GlyphPermission, GlyphRequest } from "./request-schema-requests";

export interface GlyphSignedTransferCallback {
  status: "signed";
  type: "transfer" | "sc_call";
  nonce: string;
  identity: string;
  tx_hash: string;
  target_tick: number;
}

export interface GlyphSignedMessageCallback {
  status: "signed";
  type: "sign_message";
  nonce: string;
  identity: string;
  signature: string;
  public_key: string;
}

export interface GlyphConnectedCallback {
  status: "connected";
  type: "connect";
  nonce: string;
  identity: string;
  permissions: GlyphPermission[];
}

export interface GlyphVerifiedCallback {
  status: "verified";
  type: "verify_message";
  nonce: string;
  valid: boolean;
  identity: string;
}

export interface GlyphRejectedCallback {
  status: "rejected";
  type: GlyphRequest["type"];
  nonce: string;
  reason: "user_rejected";
}

export type GlyphCallbackResponse =
  | GlyphSignedTransferCallback
  | GlyphSignedMessageCallback
  | GlyphConnectedCallback
  | GlyphVerifiedCallback
  | GlyphRejectedCallback;
