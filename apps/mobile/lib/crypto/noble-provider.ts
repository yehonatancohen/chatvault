/**
 * A3 — `CryptoProvider` for Hermes.
 *
 * Hermes has no `crypto.subtle`, so `createWebCryptoProvider` cannot be used on this platform
 * at all. This is the replacement, and the choice of *how* is the interesting part.
 *
 * **AES-256-GCM and PBKDF2 are pure JavaScript here** (`@noble/ciphers`, `@noble/hashes`),
 * not a native binding. `react-native-quick-crypto` would be faster, and the reason to prefer
 * this anyway is testability: pure JS runs under Node, so this provider is checked in CI
 * *against WebCrypto itself* — `noble-provider.test.ts` seals with one and opens with the
 * other, in both directions. That matters more than speed, because the failure it prevents is
 * unrecoverable: if mobile and web disagree about AES-GCM or PBKDF2 by even a parameter, an
 * archive written on the phone cannot be opened by the web viewer, and the user finds out
 * long after they deleted the original chat. Every other mobile port in this app is verifiable
 * only on a device; this one does not have to be.
 *
 * SHA-256 and the CSPRNG stay native, injected as `NativeCryptoBindings` — `sha256` runs over
 * every media blob, where pure JS would be felt, and a random generator is the one primitive
 * that must come from the platform. `expo-crypto-provider.ts` supplies both.
 *
 * **The known cost.** Sealing is pure JS, so throughput is bounded by Hermes, and media blobs
 * are the bulk of an archive. That ceiling has not been measured on a device yet. If it turns
 * out to be too slow, the swap is one file — implement these same four methods over
 * `react-native-quick-crypto` and keep this one as the reference the tests still run against.
 */

import { gcm } from "@noble/ciphers/aes.js";
import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import {
  IV_LENGTH,
  KEY_LENGTH,
  UnsupportedKdfError,
  type CryptoProvider,
} from "@chatvault/core";

/** The two primitives worth taking from the platform rather than computing in JS. */
export interface NativeCryptoBindings {
  /** Must be a CSPRNG. `Math.random` is not acceptable here under any circumstances. */
  randomBytes(length: number): Uint8Array;
  sha256(data: Uint8Array): Promise<Uint8Array>;
}

export function createNobleCryptoProvider(native: NativeCryptoBindings): CryptoProvider {
  return {
    randomBytes(length) {
      const bytes = native.randomBytes(length);
      // A short read here would silently weaken every key and IV in the archive, and the
      // result still looks like random bytes. Cheap to check, impossible to notice otherwise.
      if (bytes.length !== length) {
        throw new Error(`randomBytes(${length}) returned ${bytes.length} bytes`);
      }
      return bytes;
    },

    sha256(data) {
      return native.sha256(data);
    },

    async seal(key, plaintext, aad) {
      assertKeyLength(key);
      const iv = this.randomBytes(IV_LENGTH);
      // noble's `gcm` appends the 16-byte tag to the ciphertext, which is exactly WebCrypto's
      // layout — that is what makes the two interoperable without a repacking step.
      const ciphertext = gcm(key, iv, aad).encrypt(plaintext);
      return { iv, ciphertext };
    },

    async open(key, sealed, aad) {
      assertKeyLength(key);
      return gcm(key, sealed.iv, aad).decrypt(sealed.ciphertext);
    },

    async deriveKey(passphrase, params) {
      // Same guard, same reason as `createWebCryptoProvider`: deriving a PBKDF2 key for an
      // Argon2id archive yields a wrong key and reports "wrong passphrase" forever, for a
      // passphrase that was always right. `@noble/hashes` does ship Argon2id, but a pure-JS
      // memory-hard KDF at real parameters is far too slow on Hermes to enable honestly, so
      // this build declines it rather than pretending. See `packages/core/CLAUDE.md`.
      if (params.algorithm !== "PBKDF2-SHA256") throw new UnsupportedKdfError(params.algorithm);

      return pbkdf2Async(nobleSha256, passphrase, params.salt, {
        c: params.iterations,
        dkLen: KEY_LENGTH,
      });
    },
  };
}

function assertKeyLength(key: Uint8Array): void {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`AES-256-GCM needs a ${KEY_LENGTH}-byte key; got ${key.length}`);
  }
}
