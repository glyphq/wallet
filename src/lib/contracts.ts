// Qubic on-chain contract indices and input types.
// Verify these against the Qubic protocol source before shipping.

export const QUTIL = {
  index: 4,
  SendToManyV1: 1,
  BurnQu: 2,
} as const;

export const QEARN = {
  index: 6,
  LockInQearn: 1,
  UnlockInQearn: 2,
} as const;
