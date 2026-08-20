/**
 * Passphrase -> archive key, for the bundle-open flow (B0a).
 *
 * There is no share link here, so no key ever arrives in a URL fragment — the only thing a
 * member has is the `.cvault` file and a passphrase. `ArchiveHeader.keyWrapping` (cleartext,
 * see `archive/format.ts`) carries everything needed to go from a passphrase back to the
 * archive key. Mirrors the pattern in `packages/core/src/archive/reader.test.ts`
 * ("goes passphrase -> header -> key -> manifest -> messages").
 */

import type { ArchiveHeader, CryptoProvider } from "@chatvault/core";
import { fromBase64 } from "./base64";

export class WrongPassphraseError extends Error {
  constructor() {
    super("That passphrase does not open this archive.");
    this.name = "WrongPassphraseError";
  }
}

export async function unwrapArchiveKey(
  header: ArchiveHeader,
  passphrase: string,
  crypto: CryptoProvider,
): Promise<Uint8Array> {
  const { keyWrapping } = header;
  const wrappingKey = await crypto.deriveKey(passphrase, {
    salt: fromBase64(keyWrapping.saltBase64),
    iterations: keyWrapping.iterations,
    algorithm: keyWrapping.algorithm,
  });

  try {
    return await crypto.open(wrappingKey, {
      iv: fromBase64(keyWrapping.ivBase64),
      ciphertext: fromBase64(keyWrapping.wrappedKeyBase64),
    });
  } catch {
    // AES-GCM authentication failure looks identical whether the passphrase or the bundle is
    // wrong; from the caller's side there is no way to tell them apart, so this is the only
    // honest message.
    throw new WrongPassphraseError();
  }
}
