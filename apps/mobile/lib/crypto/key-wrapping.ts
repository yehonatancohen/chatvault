/**
 * Passphrase ⇄ archive key.
 *
 * The phone creates the wrapping; the web viewer undoes it (`apps/web/lib/unwrap-key.ts`).
 * Those two halves run on different platforms, in different providers, usually months apart —
 * and if they disagree, the archive is unopenable and there is no second copy to fall back on,
 * because the whole product is built around the user having deleted the original.
 * `key-wrapping.test.ts` therefore wraps with the mobile provider and unwraps with WebCrypto.
 *
 * Why a passphrase exists at all, when the key is in the Keychain: a key that lives only in the
 * device keychain dies with the device, and the archive dies with it. `apps/mobile/CLAUDE.md`
 * states the rule — always keep the passphrase path working.
 */

import {
  KEY_LENGTH,
  type CryptoProvider,
  type KeyWrapping,
} from "@chatvault/core";
import { fromBase64, toBase64 } from "./base64";

/**
 * PBKDF2 cost.
 *
 * OWASP's floor for PBKDF2-HMAC-SHA256 is 600,000, and that assumes a native implementation.
 * This one is pure JS on Hermes (see `noble-provider.ts`), where it is roughly an order of
 * magnitude slower, so this is the honest compromise: high enough to be worth something
 * against an offline attacker with the file, low enough that unlocking does not appear to hang
 * on a phone. It is recorded per-archive in the header, so raising it later costs nothing —
 * old archives keep opening at their own cost.
 *
 * **Measure this on a device.** If unlocking takes more than a couple of seconds, the fix is a
 * native KDF binding, not a smaller number.
 */
export const PBKDF2_ITERATIONS = 210_000;

const SALT_LENGTH = 16;

export class WeakPassphraseError extends Error {
  constructor() {
    super("Use at least 8 characters. This passphrase is the only way back into the archive.");
    this.name = "WeakPassphraseError";
  }
}

export class WrongPassphraseError extends Error {
  constructor() {
    super("That passphrase does not open this archive.");
    this.name = "WrongPassphraseError";
  }
}

/** A fresh archive key. Never derived from anything the user types. */
export function createArchiveKey(crypto: CryptoProvider): Uint8Array {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Wrap an archive key under a passphrase, producing the cleartext header's `keyWrapping`.
 *
 * Note what is *not* here: the archive key itself, in any form. `ArchiveHeader`'s doc comment
 * is explicit that the header carries the wrapped key only.
 */
export async function wrapArchiveKey(
  key: Uint8Array,
  passphrase: string,
  crypto: CryptoProvider,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<KeyWrapping> {
  if (passphrase.length < 8) throw new WeakPassphraseError();

  const salt = crypto.randomBytes(SALT_LENGTH);
  const wrappingKey = await crypto.deriveKey(passphrase, {
    salt,
    iterations,
    algorithm: "PBKDF2-SHA256",
  });
  const sealed = await crypto.seal(wrappingKey, key);

  return {
    algorithm: "PBKDF2-SHA256",
    saltBase64: toBase64(salt),
    iterations,
    wrappedKeyBase64: toBase64(sealed.ciphertext),
    ivBase64: toBase64(sealed.iv),
  };
}

/** The inverse. Mirrors `apps/web/lib/unwrap-key.ts` exactly — deliberately. */
export async function unwrapArchiveKey(
  wrapping: KeyWrapping,
  passphrase: string,
  crypto: CryptoProvider,
): Promise<Uint8Array> {
  const wrappingKey = await crypto.deriveKey(passphrase, {
    salt: fromBase64(wrapping.saltBase64),
    iterations: wrapping.iterations,
    algorithm: wrapping.algorithm,
  });

  try {
    return await crypto.open(wrappingKey, {
      iv: fromBase64(wrapping.ivBase64),
      ciphertext: fromBase64(wrapping.wrappedKeyBase64),
    });
  } catch {
    // AES-GCM authentication failure looks the same whether the passphrase is wrong or the
    // header was corrupted. From here the two are indistinguishable, so this is the only
    // honest message — and an `UnsupportedKdfError` from `deriveKey` deliberately escapes
    // uncaught, because "this build can't open that archive" is a different thing entirely.
    throw new WrongPassphraseError();
  }
}
