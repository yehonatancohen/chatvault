/**
 * UTF-8 encoding without depending on an undeclared global.
 *
 * `TextEncoder` and `TextDecoder` are not part of `lib ES2022`. Core compiled against them
 * anyway only because vitest's types dragged the Node definitions in — so the package
 * typechecked here while failing to compile in a consumer with a bare ES2022 lib, which is
 * exactly what a React Native app is. That is a hole in invariant 3, not a config annoyance.
 *
 * Rather than declare the globals ambiently (which collides with the DOM lib in the web app,
 * where they are already declared), these look the runtime up through `globalThis` behind a
 * narrow structural type and fall back to a manual implementation. Every runtime we target has
 * them; the fallback exists so that a missing global degrades to slow rather than broken.
 */

interface TextEncoderLike {
  encode(input: string): Uint8Array;
}

interface TextDecoderLike {
  decode(input: Uint8Array): string;
}

const runtime = globalThis as {
  TextEncoder?: new () => TextEncoderLike;
  TextDecoder?: new (label?: string) => TextDecoderLike;
};

function manualEncode(input: string): Uint8Array {
  const out: number[] = [];
  for (const ch of input) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000)
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
  }
  return Uint8Array.from(out);
}

function manualDecode(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b0 = bytes[i++] ?? 0;
    let cp: number;
    if (b0 < 0x80) cp = b0;
    else if ((b0 & 0xe0) === 0xc0) cp = ((b0 & 0x1f) << 6) | ((bytes[i++] ?? 0) & 0x3f);
    else if ((b0 & 0xf0) === 0xe0)
      cp =
        ((b0 & 0x0f) << 12) |
        (((bytes[i++] ?? 0) & 0x3f) << 6) |
        ((bytes[i++] ?? 0) & 0x3f);
    else
      cp =
        ((b0 & 0x07) << 18) |
        (((bytes[i++] ?? 0) & 0x3f) << 12) |
        (((bytes[i++] ?? 0) & 0x3f) << 6) |
        ((bytes[i++] ?? 0) & 0x3f);
    out += String.fromCodePoint(cp);
  }
  return out;
}

/** UTF-8 bytes for a string. */
export function encodeUtf8(input: string): Uint8Array {
  const Encoder = runtime.TextEncoder;
  return Encoder ? new Encoder().encode(input) : manualEncode(input);
}

/** String from UTF-8 bytes. */
export function decodeUtf8(bytes: Uint8Array): string {
  const Decoder = runtime.TextDecoder;
  return Decoder ? new Decoder().decode(bytes) : manualDecode(bytes);
}
