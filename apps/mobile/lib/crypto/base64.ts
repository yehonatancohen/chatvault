/**
 * Base64, implemented rather than borrowed.
 *
 * `apps/web` uses `btoa`/`atob`, which are browser globals. Hermes does not reliably have
 * them, and reaching for a global that may not exist is exactly the class of bug that kills
 * this app at launch with no stack (see `apps/mobile/CLAUDE.md`, "Dependency pinning"). Twenty
 * lines that provably work everywhere beat a polyfill whose presence depends on the runtime.
 *
 * Plain base64, not base64url: this is the encoding `KeyWrapping` and the archive header use,
 * and the web viewer must be able to read exactly what this writes.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Reverse lookup, built once. `-1` marks a character that is not part of the alphabet. */
const LOOKUP = (() => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) table[ALPHABET.charCodeAt(i)] = i;
  return table;
})();

export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];

    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : ALPHABET[b2 & 0x3f];
  }
  return out;
}

export class InvalidBase64Error extends Error {
  constructor(readonly detail: string) {
    super(`Not valid base64: ${detail}`);
    this.name = "InvalidBase64Error";
  }
}

export function fromBase64(input: string): Uint8Array {
  // Whitespace is legal in base64 as transmitted and meaningless; padding is positional and
  // carries no bits, so both come off before decoding.
  const clean = input.replace(/[\s]/g, "").replace(/=+$/, "");
  if (clean.length % 4 === 1) throw new InvalidBase64Error(`length ${clean.length}`);

  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let outIndex = 0;
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const value = code < 128 ? LOOKUP[code]! : -1;
    // Refusing an unknown character matters here: this decodes a wrapped archive key, and a
    // silently-skipped character would derive a wrong key and read as "wrong passphrase".
    if (value < 0) throw new InvalidBase64Error(`character ${JSON.stringify(clean[i])} at ${i}`);

    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[outIndex++] = (buffer >> bits) & 0xff;
    }
  }

  return out.subarray(0, outIndex);
}
