// Embed-key generation. The key is `ek_<prefix>.<secret>`:
//   - prefix: stored plaintext for O(1) lookup
//   - secret: the sensitive half; a hash is stored for verification
//   - full key: also stored (it's a *publishable* key — lives in the customer's
//     page source; the origin allow-list is what secures it) so it can be shown
//     again behind a password gate.
// Uses Web Crypto — call only from actions (not queries/mutations).

export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function generateEmbedKey(): Promise<{
  key: string;
  prefix: string;
  hash: string;
}> {
  const prefix = randomHex(6);
  const secret = randomHex(18);
  const key = `ek_${prefix}.${secret}`;
  const hash = await sha256Hex(secret);
  return { key, prefix, hash };
}
