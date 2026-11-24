import { z } from "zod";
import {
  MAX_REQUEST_AMOUNT,
  MAX_REQUEST_BINARY_BYTES,
} from "./request-schema-limits";

const MAX_BASE64_CHARS = Math.ceil(MAX_REQUEST_BINARY_BYTES / 3) * 4;

function isBase64(value: string): boolean {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

export const dappMetaSchema = z.object({
  name: z.string().max(256).optional().default(""),
  origin: z.string().max(2048),
  icon: z.string().max(2048).optional(),
});

export const baseRequestSchema = z.object({
  dapp: dappMetaSchema,
  nonce: z.string().min(1).max(256),
  exp: z.number().int().positive().optional(),
});

export const amountSchema = z.union([
  z.number().int().safe().nonnegative(),
  z.string().max(20).regex(/^\d+$/, "Amount must be an unsigned integer"),
]).refine((value) => BigInt(value) <= MAX_REQUEST_AMOUNT, "Amount exceeds the maximum supported value");

export const binaryDataSchema = z.string()
  .max(MAX_BASE64_CHARS, "Binary data is too large")
  .refine(isBase64, "Binary data must be valid base64");

export const tickOffsetSchema = z.number().int().min(1).max(60);
