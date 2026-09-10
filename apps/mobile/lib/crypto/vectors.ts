/**
 * Known-answer vectors, and why they are the bridge that makes the rest of the testing work.
 *
 * `noble-provider.test.ts` proves, under Node, that the mobile provider and WebCrypto agree.
 * But the mobile provider does not *run* under Node in production — it runs under Hermes, on a
 * phone, where no WebCrypto exists to compare against. Without something more, "mobile and web
 * agree" is a claim about a JS engine the app never uses.
 *
 * These constants close that gap. They were produced by Node's WebCrypto (the same
 * implementation the web viewer uses in the browser) over fixed inputs, and they are checked
 * in two places:
 *
 * - `noble-provider.test.ts`, in CI, so a change to either side is caught immediately, and so
 *   the constants themselves are re-derived rather than trusted.
 * - `lib/dev/pipeline-check.ts`, on the device, where matching these bytes is proof that
 *   AES-256-GCM and PBKDF2 under Hermes produce exactly what a browser produces.
 *
 * Match them on a phone and an archive written on that phone opens in the web viewer. That is
 * the whole claim, and it is otherwise unverifiable without deleting a real chat to find out.
 *
 * Do not "regenerate" these to make a failing test pass. They are correct by construction; a
 * mismatch means one of the two providers changed behaviour, which is exactly what they exist
 * to catch.
 */

/** UTF-8 `"שלום hello"` — deliberately mixed-script, because encoding bugs hide in ASCII. */
export const PLAINTEXT = "שלום hello";

export const AES_KEY_BYTES = Uint8Array.from({ length: 32 }, (_, i) => i);
export const AES_IV_BYTES = Uint8Array.from({ length: 12 }, (_, i) => 0xa0 + i);

/** A real AAD, in the shape `aadFor(archiveId, path)` produces. */
export const AES_AAD = "cvault:v1:archive-42:chunks/3.jsonl.enc";

/** AES-256-GCM ciphertext ‖ tag for the above. WebCrypto appends the tag; so does noble. */
export const AES_GCM_CIPHERTEXT_HEX =
  "31b1abb1925ed522420de2bf6b15be7b67bb1808d4e70920b32af494b21c";

export const PBKDF2_PASSPHRASE = "correct horse battery staple";
export const PBKDF2_SALT = "chatvault-test-salt";
export const PBKDF2_ITERATIONS = 4096;
export const PBKDF2_KEY_HEX =
  "53ddf0b881faac446d1b177201d54db80215df3bc9fc7b299fa8cd648b784573";

export const SHA256_HEX = "8a6d11cc220a850a3d885f2408adb33a3b6c5f826031dfac05495fd7a9601357";

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}
