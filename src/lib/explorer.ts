import { openUrl } from "@tauri-apps/plugin-opener";

const EXPLORER_ORIGIN = "https://explorer.glyphq.org";

export function explorerAccountUrl(identity: string): string {
  return `${EXPLORER_ORIGIN}/accounts/${encodeURIComponent(identity)}`;
}

export function explorerTransactionUrl(hash: string): string {
  return `${EXPLORER_ORIGIN}/transactions/${encodeURIComponent(hash)}`;
}

export function explorerTickUrl(tick: number): string {
  return `${EXPLORER_ORIGIN}/ticks/${tick}`;
}

export function explorerEpochUrl(epoch: number): string {
  return `${EXPLORER_ORIGIN}/epochs/${epoch}`;
}

/** Opens an explorer URL in the system browser. */
export function openExplorer(url: string): void {
  void openUrl(url).catch((error) => {
    console.error("[glyph] could not open explorer:", error);
  });
}
