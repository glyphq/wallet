export function canUseLegacyPayLinks(networkName: "mainnet" | "testnet" | "custom"): boolean {
  // The current glyph://pay format carries no network binding. Treating it as
  // portable would let a link prepared for one chain be acted on another.
  return networkName === "mainnet";
}
