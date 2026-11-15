import type { StateStorage } from "zustand/middleware";
import { LazyStore } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";

const _disk = new LazyStore("glyph.json");

/** Encrypted Tauri-store persistence for the Zustand persisted store. */
export const tauriStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const raw = await _disk.get<string>(name);
      if (raw == null) return null;
      return await invoke<string>("decrypt_store_value", { value: raw });
    } catch (err) {
      console.error("[glyph] disk read failed:", err);
      window.dispatchEvent(new CustomEvent("glyph:disk-read-error"));
      throw err;
    }
  },
  setItem: async (name, value) => {
    let encrypted: string;
    try {
      encrypted = await invoke<string>("encrypt_store_value", { value });
    } catch (err) {
      console.error("[glyph] encrypt_store_value failed:", err);
      window.dispatchEvent(new CustomEvent("glyph:disk-write-error"));
      throw err;
    }
    try {
      await _disk.set(name, encrypted);
      await _disk.save();
    } catch (err) {
      console.error("[glyph] disk write failed, retrying once:", err);
      try {
        await _disk.set(name, encrypted);
        await _disk.save();
      } catch (err2) {
        console.error(
          "[glyph] disk write failed permanently — data may be lost on restart:",
          err2
        );
        window.dispatchEvent(new CustomEvent("glyph:disk-write-error"));
        throw err2;
      }
    }
  },
  removeItem: async (name) => {
    try {
      await _disk.delete(name);
      await _disk.save();
    } catch (err) {
      console.error("[glyph] disk delete failed:", err);
      window.dispatchEvent(new CustomEvent("glyph:disk-write-error"));
      throw err;
    }
  },
};
