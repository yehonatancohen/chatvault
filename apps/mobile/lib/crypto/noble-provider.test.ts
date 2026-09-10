/**
 * The cross-provider check.
 *
 * The point of these tests is not that the mobile provider works — it is that it agrees,
 * byte for byte, with the provider the web viewer uses. An archive is written on a phone and
 * opened in a browser, often much later and usually after the original chat has been deleted.
 * If the two providers disagree about AES-GCM layout, AAD handling or PBKDF2 parameters, the
 * archive is unopenable and there is nothing left to re-derive it from.
 *
 * So every case here seals with one provider and opens with the other, in both directions.
 * Running under Node is what makes that possible: WebCrypto is right there to be the
 * counterparty, which is why this provider is pure JS (see `noble-provider.ts`).
 */

import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createWebCryptoProvider,
  IV_LENGTH,
  KEY_LENGTH,
  UnsupportedKdfError,
  type CryptoProvider,
} from "@chatvault/core";
import { createNobleCryptoProvider } from "./noble-provider";
import * as vectors from "./vectors";

const web: CryptoProvider = createWebCryptoProvider(
  webcrypto.subtle as never,
  (array) => webcrypto.getRandomValues(array),
);

const mobile: CryptoProvider = createNobleCryptoProvider({
  randomBytes: (length) => webcrypto.getRandomValues(new Uint8Array(length)),
  sha256: async (data) =>
    new Uint8Array(await webcrypto.subtle.digest("SHA-256", data as unknown as ArrayBuffer)),
});

const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);
const key = (fill: number): Uint8Array => new Uint8Array(KEY_LENGTH).fill(fill);

describe("createNobleCryptoProvider", () => {
  it("round-trips its own sealed bytes", async () => {
    const sealed = await mobile.seal(key(1), bytes("archive chunk"));
    expect(await mobile.open(key(1), sealed)).toEqual(bytes("archive chunk"));
  });

  it("produces a fresh IV of the GCM-native length every time", async () => {
    const first = await mobile.seal(key(1), bytes("x"));
    const second = await mobile.seal(key(1), bytes("x"));
    expect(first.iv).toHaveLength(IV_LENGTH);
    // A repeated IV under one key is catastrophic for GCM, not merely untidy.
    expect(first.iv).not.toEqual(second.iv);
    expect(first.ciphertext).not.toEqual(second.ciphertext);
  });

  it("opens what WebCrypto sealed", async () => {
    const sealed = await web.seal(key(7), bytes("written by the web viewer"));
    expect(await mobile.open(key(7), sealed)).toEqual(bytes("written by the web viewer"));
  });

  it("seals what WebCrypto can open", async () => {
    const sealed = await mobile.seal(key(7), bytes("written on the phone"));
    expect(await web.open(key(7), sealed)).toEqual(bytes("written on the phone"));
  });

  it("agrees with WebCrypto about AAD, in both directions", async () => {
    // Every object in an archive is sealed under an AAD naming its own path (`aadFor`), so a
    // mismatch here would break exactly the archives that are otherwise fine.
    const aad = bytes("cvault:v1:archive-42:chunks/3.jsonl.enc");

    const fromWeb = await web.seal(key(3), bytes("chunk three"), aad);
    expect(await mobile.open(key(3), fromWeb, aad)).toEqual(bytes("chunk three"));

    const fromMobile = await mobile.seal(key(3), bytes("chunk three"), aad);
    expect(await web.open(key(3), fromMobile, aad)).toEqual(bytes("chunk three"));
  });

  it("rejects a wrong AAD rather than returning plaintext", async () => {
    const sealed = await mobile.seal(key(3), bytes("chunk three"), bytes("path/a"));
    await expect(mobile.open(key(3), sealed, bytes("path/b"))).rejects.toThrow();
    // The swap that AAD binding exists to prevent must also fail the other way round.
    await expect(web.open(key(3), sealed, bytes("path/b"))).rejects.toThrow();
  });

  it("rejects a wrong key", async () => {
    const sealed = await mobile.seal(key(1), bytes("secret"));
    await expect(mobile.open(key(2), sealed)).rejects.toThrow();
  });

  it("rejects tampered ciphertext", async () => {
    const sealed = await mobile.seal(key(1), bytes("secret"));
    const tampered = Uint8Array.from(sealed.ciphertext);
    tampered[0] = (tampered[0]! ^ 0xff) & 0xff;
    await expect(mobile.open(key(1), { iv: sealed.iv, ciphertext: tampered })).rejects.toThrow();
  });

  it("derives the same key as WebCrypto from one passphrase", async () => {
    // The single most important agreement in the file: this is what lets a passphrase typed
    // into the web viewer open an archive whose key was wrapped on the phone.
    const params = {
      salt: new Uint8Array(16).fill(9),
      iterations: 10_000,
      algorithm: "PBKDF2-SHA256" as const,
    };
    const fromMobile = await mobile.deriveKey("correct horse battery staple", params);
    const fromWeb = await web.deriveKey("correct horse battery staple", params);

    expect(fromMobile).toHaveLength(KEY_LENGTH);
    expect(fromMobile).toEqual(fromWeb);
  });

  it("derives a different key from a different passphrase", async () => {
    const params = {
      salt: new Uint8Array(16).fill(9),
      iterations: 1000,
      algorithm: "PBKDF2-SHA256" as const,
    };
    expect(await mobile.deriveKey("a", params)).not.toEqual(await mobile.deriveKey("b", params));
  });

  it("derives a key that unwraps across providers end to end", async () => {
    // The real passphrase path: wrap the archive key on one side, unwrap it on the other.
    const params = {
      salt: new Uint8Array(16).fill(4),
      iterations: 5_000,
      algorithm: "PBKDF2-SHA256" as const,
    };
    const archiveKey = key(42);

    const wrappingKey = await mobile.deriveKey("passphrase", params);
    const wrapped = await mobile.seal(wrappingKey, archiveKey);

    const webWrappingKey = await web.deriveKey("passphrase", params);
    expect(await web.open(webWrappingKey, wrapped)).toEqual(archiveKey);
  });

  it("refuses Argon2id instead of silently deriving a PBKDF2 key", async () => {
    // `packages/core/CLAUDE.md`: the nastiest failure mode in the codebase if it regresses —
    // a correct passphrase reported wrong, forever.
    await expect(
      mobile.deriveKey("p", {
        salt: new Uint8Array(16),
        iterations: 1,
        algorithm: "Argon2id",
      }),
    ).rejects.toBeInstanceOf(UnsupportedKdfError);
  });

  it("hashes via the injected native binding", async () => {
    const digest = await mobile.sha256(bytes("abc"));
    expect(Buffer.from(digest).toString("hex")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("rejects a key that is not 32 bytes rather than deriving something weaker", async () => {
    await expect(mobile.seal(new Uint8Array(16).fill(1), bytes("x"))).rejects.toThrow(/32-byte/);
  });

  it("rejects a short read from the platform CSPRNG", async () => {
    const short = createNobleCryptoProvider({
      randomBytes: () => new Uint8Array(4),
      sha256: async () => new Uint8Array(32),
    });
    expect(() => short.randomBytes(32)).toThrow(/returned 4 bytes/);
  });

  it("round-trips a blob larger than one AES block, unaligned", async () => {
    // Filled in 32 KiB slices: `getRandomValues` refuses more than 64 KiB in one call, and
    // the point here is a plaintext that crosses block *and* buffer boundaries unaligned.
    const blob = new Uint8Array(64 * 1024 + 7);
    for (let offset = 0; offset < blob.length; offset += 32 * 1024) {
      const slice = blob.subarray(offset, Math.min(offset + 32 * 1024, blob.length));
      webcrypto.getRandomValues(slice);
    }
    const sealed = await mobile.seal(key(5), blob);
    expect(await web.open(key(5), sealed)).toEqual(blob);
  });

  it("round-trips empty plaintext", async () => {
    const sealed = await mobile.seal(key(5), new Uint8Array(0));
    expect(await web.open(key(5), sealed)).toEqual(new Uint8Array(0));
  });
});

/**
 * The vectors in `vectors.ts` are what the *device* check compares against, where there is no
 * WebCrypto to be the counterparty. These tests re-derive them from WebCrypto here, so the
 * constants are proven rather than trusted, and so that a change on either side fails in CI
 * rather than on a phone.
 */
describe("known-answer vectors", () => {
  const encoder = new TextEncoder();

  it("WebCrypto still produces the recorded PBKDF2 key", async () => {
    const derived = await web.deriveKey(vectors.PBKDF2_PASSPHRASE, {
      salt: encoder.encode(vectors.PBKDF2_SALT),
      iterations: vectors.PBKDF2_ITERATIONS,
      algorithm: "PBKDF2-SHA256",
    });
    expect(vectors.toHex(derived)).toBe(vectors.PBKDF2_KEY_HEX);
  });

  it("the mobile provider derives the same key", async () => {
    const derived = await mobile.deriveKey(vectors.PBKDF2_PASSPHRASE, {
      salt: encoder.encode(vectors.PBKDF2_SALT),
      iterations: vectors.PBKDF2_ITERATIONS,
      algorithm: "PBKDF2-SHA256",
    });
    expect(vectors.toHex(derived)).toBe(vectors.PBKDF2_KEY_HEX);
  });

  it("the recorded AES-GCM ciphertext decrypts under both providers", async () => {
    const sealed = {
      iv: vectors.AES_IV_BYTES,
      ciphertext: hexToBytes(vectors.AES_GCM_CIPHERTEXT_HEX),
    };
    const aad = encoder.encode(vectors.AES_AAD);

    expect(new TextDecoder().decode(await web.open(vectors.AES_KEY_BYTES, sealed, aad))).toBe(
      vectors.PLAINTEXT,
    );
    expect(new TextDecoder().decode(await mobile.open(vectors.AES_KEY_BYTES, sealed, aad))).toBe(
      vectors.PLAINTEXT,
    );
  });

  it("sealing the vector's inputs reproduces the recorded ciphertext exactly", async () => {
    // GCM is deterministic given key, IV, AAD and plaintext, so this is a byte-for-byte check
    // of the encryption path, not just of decryption.
    const gcmCiphertext = await sealWithFixedIv(
      vectors.AES_KEY_BYTES,
      vectors.AES_IV_BYTES,
      encoder.encode(vectors.PLAINTEXT),
      encoder.encode(vectors.AES_AAD),
    );
    expect(vectors.toHex(gcmCiphertext)).toBe(vectors.AES_GCM_CIPHERTEXT_HEX);
  });

  it("the recorded SHA-256 still matches", async () => {
    expect(vectors.toHex(await mobile.sha256(encoder.encode(vectors.PLAINTEXT)))).toBe(
      vectors.SHA256_HEX,
    );
  });
});

/** WebCrypto directly: `CryptoProvider.seal` picks its own IV, and this needs a fixed one. */
async function sealWithFixedIv(
  key: Uint8Array,
  iv: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const cryptoKey = await webcrypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  return new Uint8Array(
    await webcrypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, cryptoKey, plaintext),
  );
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
