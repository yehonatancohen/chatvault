/**
 * Crypto ports.
 *
 * Core defines the interface; platforms supply the implementation. Nothing here touches a
 * global — `createWebCryptoProvider` takes a `SubtleCrypto` as an argument rather than
 * reaching for `globalThis.crypto`, which is what keeps this package isomorphic (root
 * CLAUDE.md invariant 3) while still shipping a real implementation.
 *
 * AES-256-GCM throughout, because it is the one modern AEAD that WebCrypto implements
 * natively — so the web viewer needs no crypto library at all, and a browser can open an
 * archive with nothing but a key in the URL fragment.
 */

import { encodeUtf8 } from "../util/utf8.js";

/** 96 bits is the GCM-native nonce size; anything else forces an extra derivation step. */
export const IV_LENGTH = 12;
export const KEY_LENGTH = 32;

export interface SealedBytes {
  readonly iv: Uint8Array;
  readonly ciphertext: Uint8Array;
}

/** Must stay in step with `KeyWrapping.algorithm` in `archive/format.ts`. */
export type KdfAlgorithm = "PBKDF2-SHA256" | "Argon2id";

export interface KdfParams {
  readonly salt: Uint8Array;
  /** Iteration / time cost. Interpreted by the algorithm named below. */
  readonly iterations: number;
  /**
   * Which KDF produced the wrapped key. Required, and providers MUST reject one they do not
   * implement — see `UnsupportedKdfError`.
   */
  readonly algorithm: KdfAlgorithm;
}

/**
 * Thrown when a provider is asked for a KDF it does not implement.
 *
 * This exists because the alternative is silent and unfixable. An archive wrapped with
 * Argon2id, opened by a provider that only knows PBKDF2, would derive a *different* key,
 * fail to unwrap, and surface as "wrong passphrase" — sending the user to re-type a
 * passphrase that was correct all along, forever. Failing loudly here turns a permanently
 * mysterious lockout into a clear "this app can't open that archive yet".
 */
export class UnsupportedKdfError extends Error {
  constructor(readonly algorithm: string) {
    super(
      `This build cannot derive keys with ${algorithm}. The archive is intact — it needs a build that implements ${algorithm}.`,
    );
    this.name = "UnsupportedKdfError";
  }
}

export interface CryptoProvider {
  randomBytes(length: number): Uint8Array;

  /** For media blobs and any multi-megabyte input — never the sync `sha256Hex`. */
  sha256(data: Uint8Array): Promise<Uint8Array>;

  /**
   * `aad` is authenticated but not encrypted. Chunk identifiers go here, so a chunk cannot be
   * silently swapped for another chunk of the same archive.
   */
  seal(key: Uint8Array, plaintext: Uint8Array, aad?: Uint8Array): Promise<SealedBytes>;

  open(
    key: Uint8Array,
    sealed: SealedBytes,
    aad?: Uint8Array,
  ): Promise<Uint8Array>;

  /** Wraps the archive key with a user passphrase. */
  deriveKey(passphrase: string, params: KdfParams): Promise<Uint8Array>;
}

/**
 * The slice of WebCrypto this package uses, declared structurally.
 *
 * `SubtleCrypto` and `CryptoKey` are DOM lib types, and adding the DOM lib to core would put
 * `window` and `document` back in scope for every file here — exactly the coupling
 * invariant 3 exists to prevent. A real `crypto.subtle` from any runtime satisfies this
 * interface structurally, so nothing is lost but the dependency.
 */
export interface CryptoKeyLike {
  readonly type: string;
}

export interface AesGcmParamsLike {
  readonly name: "AES-GCM";
  readonly iv: Uint8Array | ArrayBuffer;
  readonly additionalData?: ArrayBuffer;
}

export interface Pbkdf2ParamsLike {
  readonly name: "PBKDF2";
  readonly salt: ArrayBuffer;
  readonly iterations: number;
  readonly hash: string;
}

export interface SubtleCryptoLike {
  digest(algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer>;
  importKey(
    format: "raw",
    keyData: ArrayBuffer,
    algorithm: string | { readonly name: string },
    extractable: boolean,
    keyUsages: readonly string[],
  ): Promise<CryptoKeyLike>;
  encrypt(
    algorithm: AesGcmParamsLike,
    key: CryptoKeyLike,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer>;
  decrypt(
    algorithm: AesGcmParamsLike,
    key: CryptoKeyLike,
    data: ArrayBuffer,
  ): Promise<ArrayBuffer>;
  deriveBits(
    algorithm: Pbkdf2ParamsLike,
    baseKey: CryptoKeyLike,
    length: number,
  ): Promise<ArrayBuffer>;
}

/**
 * WebCrypto-backed provider. Works unchanged in the browser, in Node (`crypto.webcrypto`),
 * and in React Native once a WebCrypto polyfill is installed.
 *
 * Note on the KDF: this uses PBKDF2-SHA256 because it is all WebCrypto offers. Argon2id is
 * the better choice for passphrase wrapping and should replace this on mobile, where a
 * native binding is available — the port exists precisely so that swap costs nothing.
 */
export function createWebCryptoProvider(
  subtle: SubtleCryptoLike,
  getRandomValues: (array: Uint8Array) => Uint8Array,
): CryptoProvider {
  const importAesKey = (key: Uint8Array): Promise<CryptoKeyLike> =>
    subtle.importKey("raw", toArrayBuffer(key), "AES-GCM", false, ["encrypt", "decrypt"]);

  return {
    randomBytes(length) {
      return getRandomValues(new Uint8Array(length));
    },

    async sha256(data) {
      return new Uint8Array(await subtle.digest("SHA-256", toArrayBuffer(data)));
    },

    async seal(key, plaintext, aad) {
      const iv = getRandomValues(new Uint8Array(IV_LENGTH));
      const cryptoKey = await importAesKey(key);
      const ciphertext = await subtle.encrypt(
        { name: "AES-GCM", iv, ...(aad ? { additionalData: toArrayBuffer(aad) } : {}) },
        cryptoKey,
        toArrayBuffer(plaintext),
      );
      return { iv, ciphertext: new Uint8Array(ciphertext) };
    },

    async open(key, sealed, aad) {
      const cryptoKey = await importAesKey(key);
      const plaintext = await subtle.decrypt(
        {
          name: "AES-GCM",
          iv: toArrayBuffer(sealed.iv),
          ...(aad ? { additionalData: toArrayBuffer(aad) } : {}),
        },
        cryptoKey,
        toArrayBuffer(sealed.ciphertext),
      );
      return new Uint8Array(plaintext);
    },

    async deriveKey(passphrase, params) {
      // WebCrypto offers PBKDF2 and nothing else. Refuse anything else rather than quietly
      // deriving a PBKDF2 key for an Argon2id archive and reporting a wrong passphrase.
      if (params.algorithm !== "PBKDF2-SHA256") {
        throw new UnsupportedKdfError(params.algorithm);
      }

      const material = await subtle.importKey(
        "raw",
        toArrayBuffer(encodeUtf8(passphrase)),
        "PBKDF2",
        false,
        ["deriveBits"],
      );
      const bits = await subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: toArrayBuffer(params.salt),
          iterations: params.iterations,
          hash: "SHA-256",
        },
        material,
        KEY_LENGTH * 8,
      );
      return new Uint8Array(bits);
    },
  };
}

/**
 * WebCrypto rejects a `Uint8Array` that is a partial view over a larger buffer in some
 * runtimes, so every input is normalized to an exactly-sized `ArrayBuffer` first.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}
