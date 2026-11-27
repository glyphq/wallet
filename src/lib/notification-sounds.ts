import sentSound from "@/assets/sounds/01_glyph_terminal_transaction_sent.wav";
import receivedSound from "@/assets/sounds/02_glyph_terminal_transaction_received.wav";
import confirmedSound from "@/assets/sounds/03_glyph_terminal_transaction_confirmed.wav";
import expiredSound from "@/assets/sounds/04_glyph_terminal_transaction_expired.wav";
import pairRequestSound from "@/assets/sounds/05_glyph_terminal_account_pair_request.wav";
import interactionRequestSound from "@/assets/sounds/06_glyph_terminal_account_interaction_request.wav";
import { usePersistedStore } from "@/store/persisted";
import type { NotificationEventKind, NotificationSoundVolume } from "@/store/persisted";

export type NotificationSoundKey =
  | "sent"
  | "received"
  | "confirmed"
  | "expired"
  | "pair-request"
  | "interaction-request";

const SOUNDS: Record<NotificationSoundKey, string> = {
  sent: sentSound,
  received: receivedSound,
  confirmed: confirmedSound,
  expired: expiredSound,
  "pair-request": pairRequestSound,
  "interaction-request": interactionRequestSound,
};

const VOLUMES: Record<NotificationSoundVolume, number> = {
  low: 0.35,
  medium: 0.65,
  high: 1,
};

let activeAudio: HTMLAudioElement | null = null;

/** Maps a notification kind to the corresponding terminal sound. */
export function notificationSoundForKind(kind: NotificationEventKind, body = ""): NotificationSoundKey | null {
  switch (kind) {
    case "sent":
      return "sent";
    case "received":
      return "received";
    case "confirmed":
      return "confirmed";
    case "failed":
    case "expired":
      return "expired";
    case "deep_link":
      return body.toLowerCase().includes("connect") ? "pair-request" : "interaction-request";
    case "system":
      return "pair-request";
    case "price_alert":
      return "confirmed";
    default:
      return null;
  }
}

export function notificationSoundSource(key: NotificationSoundKey): string {
  return SOUNDS[key];
}

export function notificationSoundGain(volume: NotificationSoundVolume): number {
  return VOLUMES[volume] ?? VOLUMES.medium;
}

/** Plays a sample sound from the notification settings screen. */
export function previewNotificationSound(): void {
  const settings = usePersistedStore.getState().settings;
  if (!settings.notificationSoundsEnabled || typeof Audio === "undefined") return;
  try {
    activeAudio?.pause();
    const audio = new Audio(SOUNDS.confirmed);
    audio.volume = notificationSoundGain(settings.notificationSoundVolume);
    activeAudio = audio;
    void audio.play().catch(() => {});
  } catch {
    // Best effort; the settings screen remains usable without audio output.
  }
}
