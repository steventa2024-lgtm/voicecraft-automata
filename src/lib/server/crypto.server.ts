const LICENSE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LICENSE_PATTERN = /^ZERO-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/;

function randomCharacters(length: number): string {
  const output: string[] = [];
  while (output.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte >= 224) continue;
      output.push(LICENSE_ALPHABET[byte % LICENSE_ALPHABET.length]!);
      if (output.length === length) break;
    }
  }
  return output.join("");
}

export function generateLicenseKey(): string {
  return `Zero-${randomCharacters(5)}-${randomCharacters(5)}-${randomCharacters(5)}`;
}

export function normalizeLicenseKey(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return LICENSE_PATTERN.test(normalized) ? normalized : null;
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function keyHint(key: string): string {
  return `Zero-•••••-•••••-${key.slice(-5)}`;
}
