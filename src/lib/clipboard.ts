import { invoke } from "@tauri-apps/api/core";

let fallbackClearTimer: number | null = null;

export async function copyToClipboard(text: string, clearAfterSecs = 0): Promise<void> {
  try {
    await invoke("copy_to_clipboard", { text, clearAfterSecs });
    return;
  } catch {}

  await navigator.clipboard.writeText(text).catch(() => {});

  if (fallbackClearTimer !== null) {
    clearTimeout(fallbackClearTimer);
    fallbackClearTimer = null;
  }

  if (clearAfterSecs > 0) {
    fallbackClearTimer = window.setTimeout(() => {
      navigator.clipboard.writeText("").catch(() => {});
      fallbackClearTimer = null;
    }, clearAfterSecs * 1000);
  }
}

export async function clearClipboard(): Promise<void> {
  try {
    await invoke("clear_clipboard");
    return;
  } catch {}

  if (fallbackClearTimer !== null) {
    clearTimeout(fallbackClearTimer);
    fallbackClearTimer = null;
  }
  await navigator.clipboard.writeText("").catch(() => {});
}
