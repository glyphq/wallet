export const MAX_REQUEST_CHARS = 128 * 1024;
export const MAX_REQUEST_MESSAGE_CHARS = 64 * 1024;
export const MAX_REQUEST_BINARY_BYTES = 64 * 1024;
/** Native request validation accepts contract indexes 0 through 63. */
export const MAX_REQUEST_CONTRACT_INDEX = 63;

/** Native transaction amounts are signed 64-bit values. */
export const MAX_REQUEST_AMOUNT = 9_223_372_036_854_775_807n;
