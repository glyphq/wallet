import { z } from "zod";
import {
  amountSchema,
  baseRequestSchema,
  binaryDataSchema,
  dappMetaSchema,
  permissionSchema,
  tickOffsetSchema,
} from "./request-schema-base";
import {
  MAX_REQUEST_CONTRACT_INDEX,
  MAX_REQUEST_MESSAGE_CHARS,
} from "./request-schema-limits";

const transferRequestSchema = baseRequestSchema.extend({
  type: z.literal("transfer"),
  to: z.string(),
  amount: amountSchema.refine((value) => BigInt(value) > 0n, "Transfer amount must be positive"),
  from: z.string().optional(),
  tick_offset: tickOffsetSchema.optional(),
});

export const scCallRequestSchema = baseRequestSchema.extend({
  type: z.literal("sc_call"),
  contract_index: z.number().int().min(0).max(MAX_REQUEST_CONTRACT_INDEX),
  input_type: z.number().int().min(0).max(65535),
  from: z.string().optional(),
  amount: amountSchema.optional(),
  payload: binaryDataSchema.optional(),
  tick_offset: tickOffsetSchema.optional(),
});

const signMessageRequestSchema = baseRequestSchema.extend({
  type: z.literal("sign_message"),
  message: z.string().max(MAX_REQUEST_MESSAGE_CHARS),
  from: z.string().optional(),
  data: binaryDataSchema.optional(),
});

const verifyMessageRequestSchema = baseRequestSchema.extend({
  type: z.literal("verify_message"),
  message: z.string().max(MAX_REQUEST_MESSAGE_CHARS),
  data: binaryDataSchema.optional(),
  signature: binaryDataSchema,
  public_key: binaryDataSchema,
});

const connectRequestSchema = baseRequestSchema.extend({
  type: z.literal("connect"),
  permissions: z.array(permissionSchema).optional(),
});

export const glyphRequestSchema = z.discriminatedUnion("type", [
  transferRequestSchema,
  scCallRequestSchema,
  signMessageRequestSchema,
  verifyMessageRequestSchema,
  connectRequestSchema,
]);

export type DappMeta = z.infer<typeof dappMetaSchema>;
export type TransferRequest = z.infer<typeof transferRequestSchema>;
export type ScCallRequest = z.infer<typeof scCallRequestSchema>;
export type SignMessageRequest = z.infer<typeof signMessageRequestSchema>;
export type VerifyMessageRequest = z.infer<typeof verifyMessageRequestSchema>;
export type ConnectRequest = z.infer<typeof connectRequestSchema>;
export type GlyphRequest = z.infer<typeof glyphRequestSchema>;
export type GlyphPermission = z.infer<typeof permissionSchema>;
