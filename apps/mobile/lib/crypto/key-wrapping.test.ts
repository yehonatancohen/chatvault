/**
 * The passphrase path, checked across both providers.
 *
 * The scenario being defended: a user archives a chat on their phone, sets a passphrase,
 * deletes the chat in WhatsApp, and months later opens the `.cvault` in the web viewer. By
 * then the original is gone. If the wrapping the phone wrote cannot be undone by the browser,
 * there is nothing left to recover from — so the important tests here are the ones that cross
 * from one provider to the other.
 */

import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWebCryptoProvider, UnsupportedKdfError, type CryptoProvider } from "@chatvault/core";
import { createNobleCryptoProvider } from "./noble-provider";
import {
  createArchiveKey,
  unwrapArchiveKey,
  WeakPassphraseError,
  wrapArchiveKey,
  WrongPassphraseError,
} from "./key-wrapping";
import { fromBase64, InvalidBase64Error, toBase64 } from "./base64";

const web: CryptoProvider = createWebCryptoProvider(
  webcrypto.subtle as never,
  (array) => webcrypto.getRandomValues(array),
);

const mobile: CryptoProvider = createNobleCryptoProvider({
  randomBytes: (length) => webcrypto.getRandomValues(new Uint8Array(length)),
  sha256: async (data) =>
    new Uint8Array(await webcrypto.subtle.digest("SHA-256", data as unknown as ArrayBuffer)),
});

/** Low cost: these tests exercise the wiring, not PBKDF2's strength. */
const FAST = 1000;

describe("wrapArchiveKey / unwrapArchiveKey", () => {
  it("round-trips a key through a passphrase", async () => {
    const key = createArchiveKey(mobile);
    const wrapping = await wrapArchiveKey(key, "a good passphrase", mobile, FAST);

    expect(await unwrapArchiveKey(wrapping, "a good passphrase", mobile)).toEqual(key);
  });

  it("a passphrase set on the phone opens the archive in the browser", async () => {
    // The test this file exists for.
    const key = createArchiveKey(mobile);
    const wrapping = await wrapArchiveKey(key, "correct horse battery staple", mobile, FAST);

    expect(await unwrapArchiveKey(wrapping, "correct horse battery staple", web)).toEqual(key);
  });

  it("and the reverse, for an archive the web viewer created", async () => {
    const key = createArchiveKey(web);
    const wrapping = await wrapArchiveKey(key, "correct horse battery staple", web, FAST);

    expect(await unwrapArchiveKey(wrapping, "correct horse battery staple", mobile)).toEqual(key);
  });

  it("rejects the wrong passphrase with a message that says so", async () => {
    const wrapping = await wrapArchiveKey(createArchiveKey(mobile), "the right one", mobile, FAST);

    await expect(unwrapArchiveKey(wrapping, "the wrong one", mobile)).rejects.toBeInstanceOf(
      WrongPassphraseError,
    );
  });

  it("does not report a wrong passphrase when the KDF is the problem", async () => {
    // `packages/core/CLAUDE.md` calls this the nastiest regression in the codebase: an
    // Argon2id archive must not tell the user their correct passphrase is wrong.
    const wrapping = await wrapArchiveKey(createArchiveKey(mobile), "passphrase", mobile, FAST);

    await expect(
      unwrapArchiveKey({ ...wrapping, algorithm: "Argon2id" }, "passphrase", mobile),
    ).rejects.toBeInstanceOf(UnsupportedKdfError);
  });

  it("refuses a passphrase too short to be worth anything", async () => {
    await expect(
      wrapArchiveKey(createArchiveKey(mobile), "short", mobile, FAST),
    ).rejects.toBeInstanceOf(WeakPassphraseError);
  });

  it("uses a fresh salt per archive, so one cracked passphrase is not two", async () => {
    const key = createArchiveKey(mobile);
    const first = await wrapArchiveKey(key, "same passphrase", mobile, FAST);
    const second = await wrapArchiveKey(key, "same passphrase", mobile, FAST);

    expect(first.saltBase64).not.toBe(second.saltBase64);
    expect(first.wrappedKeyBase64).not.toBe(second.wrappedKeyBase64);
  });

  it("never writes the archive key into the header, in any form", async () => {
    const key = createArchiveKey(mobile);
    const wrapping = await wrapArchiveKey(key, "a good passphrase", mobile, FAST);

    const serialized = JSON.stringify(wrapping);
    expect(serialized).not.toContain(toBase64(key));
    // And the wrapped form must not be the key with extra steps.
    expect(fromBase64(wrapping.wrappedKeyBase64)).not.toEqual(key);
  });

  it("records the iteration count it actually used", async () => {
    const wrapping = await wrapArchiveKey(createArchiveKey(mobile), "passphrase", mobile, 4321);
    expect(wrapping.iterations).toBe(4321);

    // And unwrapping honours the archive's recorded cost, not today's default — otherwise
    // raising the default would lock every existing archive.
    expect(await unwrapArchiveKey(wrapping, "passphrase", web)).toHaveLength(32);
  });

  it("produces a 32-byte key from the platform CSPRNG", () => {
    const key = createArchiveKey(mobile);
    expect(key).toHaveLength(32);
    expect(key).not.toEqual(new Uint8Array(32));
  });
});

describe("base64", () => {
  it("matches the platform encoder", () => {
    for (let length = 0; length < 40; length++) {
      const bytes = webcrypto.getRandomValues(new Uint8Array(length));
      expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
    }
  });

  it("decodes what the platform encoded, at every padding length", () => {
    for (let length = 0; length < 40; length++) {
      const bytes = webcrypto.getRandomValues(new Uint8Array(length));
      const encoded = Buffer.from(bytes).toString("base64");
      expect(fromBase64(encoded)).toEqual(bytes);
    }
  });

  it("round-trips high bytes and NULs", () => {
    const bytes = Uint8Array.from([0x00, 0xff, 0x80, 0x7f, 0x00, 0x01]);
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });

  it("tolerates whitespace, which is legal in transmitted base64", () => {
    expect(fromBase64("aGVs\nbG8g\td29ybGQ=")).toEqual(new TextEncoder().encode("hello world"));
  });

  it("refuses a stray character instead of skipping it", () => {
    // Skipping would derive a wrong key from a header that is subtly corrupt, and surface as
    // an unfixable "wrong passphrase".
    expect(() => fromBase64("aGVs*bG8=")).toThrow(InvalidBase64Error);
  });

  it("refuses an impossible length", () => {
    expect(() => fromBase64("aGVsbG8gd29ybGQxMjM0NQ")).not.toThrow();
    expect(() => fromBase64("a")).toThrow(InvalidBase64Error);
  });
});
