import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { createWebCryptoProvider, UnsupportedKdfError } from "./ports.js";
import { aadFor } from "../archive/format.js";

/**
 * Node supplies WebCrypto here; the browser and React Native supply their own. Injecting it
 * is what lets core stay free of globals while still being tested against a real
 * implementation rather than a mock.
 */
const provider = createWebCryptoProvider(webcrypto.subtle, (array) =>
  webcrypto.getRandomValues(array),
);

/** `noUncheckedIndexedAccess` makes indexed writes unsafe without a length check. */
function flipFirstByte(bytes: Uint8Array): Uint8Array {
  const copy = Uint8Array.from(bytes);
  const first = copy.at(0);
  if (first === undefined) throw new Error("expected a non-empty ciphertext");
  copy.set([first ^ 0xff], 0);
  return copy;
}

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

describe("createWebCryptoProvider", () => {
  it("round-trips a payload", async () => {
    const key = provider.randomBytes(32);
    const plaintext = utf8("שלום — a message with emoji 😀 and RTL");

    const sealed = await provider.seal(key, plaintext);
    const opened = await provider.open(key, sealed);

    expect(new TextDecoder().decode(opened)).toBe(
      "שלום — a message with emoji 😀 and RTL",
    );
    // The ciphertext must not contain the plaintext, and must carry the GCM tag.
    expect(sealed.ciphertext).not.toEqual(plaintext);
    expect(sealed.ciphertext.length).toBe(plaintext.length + 16);
    expect(sealed.iv).toHaveLength(12);
  });

  it("uses a fresh nonce per seal", async () => {
    const key = provider.randomBytes(32);
    const a = await provider.seal(key, utf8("same"));
    const b = await provider.seal(key, utf8("same"));

    expect(a.iv).not.toEqual(b.iv);
    expect(a.ciphertext).not.toEqual(b.ciphertext);
  });

  it("refuses the wrong key", async () => {
    const sealed = await provider.seal(provider.randomBytes(32), utf8("secret"));
    await expect(provider.open(provider.randomBytes(32), sealed)).rejects.toThrow();
  });

  it("binds a payload to its archive and path via AAD", async () => {
    const key = provider.randomBytes(32);
    const aad = aadFor("archive-1", "chunks/0.jsonl.enc");
    const sealed = await provider.seal(key, utf8("chunk zero"), aad);

    expect(new TextDecoder().decode(await provider.open(key, sealed, aad))).toBe("chunk zero");

    // Same archive, different chunk: a swapped chunk must not open.
    await expect(
      provider.open(key, sealed, aadFor("archive-1", "chunks/1.jsonl.enc")),
    ).rejects.toThrow();

    // Same path, different archive.
    await expect(
      provider.open(key, sealed, aadFor("archive-2", "chunks/0.jsonl.enc")),
    ).rejects.toThrow();
  });

  it("detects tampering with the ciphertext", async () => {
    const key = provider.randomBytes(32);
    const sealed = await provider.seal(key, utf8("do not modify"));
    const tampered = flipFirstByte(sealed.ciphertext);

    await expect(provider.open(key, { ...sealed, ciphertext: tampered })).rejects.toThrow();
  });

  it("refuses a KDF it does not implement instead of deriving the wrong key", async () => {
    const params = {
      salt: provider.randomBytes(16),
      iterations: 10_000,
      algorithm: "Argon2id",
    } as const;

    // The failure this prevents is invisible and permanent: derive a PBKDF2 key for an
    // Argon2id archive and the unwrap fails, which surfaces to the user as "wrong
    // passphrase" for a passphrase that was always correct.
    await expect(provider.deriveKey("correct horse battery staple", params)).rejects.toThrow(
      UnsupportedKdfError,
    );
  });

  it("derives a stable key from a passphrase and salt", async () => {
    const salt = provider.randomBytes(16);
    const params = { salt, iterations: 10_000, algorithm: "PBKDF2-SHA256" } as const;

    const first = await provider.deriveKey("correct horse battery staple", params);
    const second = await provider.deriveKey("correct horse battery staple", params);
    const other = await provider.deriveKey("wrong passphrase", params);

    expect(first).toHaveLength(32);
    expect(first).toEqual(second);
    expect(first).not.toEqual(other);
  });
});
