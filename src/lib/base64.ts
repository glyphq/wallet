/** Decodes a base64 string without allowing malformed input to escape UI previews. */
export function base64ToBytes(value: string): Uint8Array {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return new Uint8Array(0);
  }
}
