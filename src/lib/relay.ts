/**
 * Pairing-code helpers retained for the setup guide.
 * The website no longer opens a relay channel or sends build commands.
 * Device approval happens in the desktop application.
 */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function makePairCode(len = 6): string {
  let out = "";
  const bytes = new Uint8Array(len);
  if (typeof crypto !== "undefined") crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i += 1) {
    out += CODE_ALPHABET[(bytes[i] || Math.floor(Math.random() * 255)) % CODE_ALPHABET.length];
  }
  return out;
}

export function normalizeCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}
