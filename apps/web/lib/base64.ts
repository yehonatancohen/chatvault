/**
 * Plain base64 (not base64url) — the encoding `KeyWrapping` and the archive header use.
 * Distinct from `fragment-key.ts`'s base64url decoder, which reads the URL fragment instead.
 */

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function fromBase64(input: string): Uint8Array {
  const binary = atob(input);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}
