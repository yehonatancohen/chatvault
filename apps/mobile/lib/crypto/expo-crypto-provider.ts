/**
 * The device's `CryptoProvider`: `createNobleCryptoProvider` bound to expo-crypto's natives.
 *
 * Everything interesting is in `noble-provider.ts`, which is tested against WebCrypto in Node.
 * This file is deliberately the thinnest possible layer over the two primitives that must come
 * from the platform, so that the part which cannot be tested off-device is also the part with
 * nothing in it to get wrong.
 *
 * `getRandomBytes` is expo-crypto's synchronous CSPRNG (SecRandomCopyBytes on iOS,
 * SecureRandom on Android). `digest` is the platform's SHA-256, which is what keeps hashing a
 * multi-megabyte media blob off the JS thread's critical path.
 */

import * as Crypto from "expo-crypto";
import type { CryptoProvider } from "@chatvault/core";
import { createNobleCryptoProvider } from "./noble-provider";

let cached: CryptoProvider | undefined;

/** One provider per app run. Nothing here holds a key, so sharing it is safe and cheaper. */
export function getCryptoProvider(): CryptoProvider {
  cached ??= createNobleCryptoProvider({
    randomBytes: (length) => Crypto.getRandomBytes(length),
    sha256: async (data) => {
      // `digest` wants a BufferSource and returns an ArrayBuffer; a `Uint8Array` that is a
      // partial view over a larger buffer would otherwise hash the whole backing store, so
      // this passes an exactly-sized copy. Same hazard `toArrayBuffer` handles in core.
      const exact = new Uint8Array(data.length);
      exact.set(data);
      return new Uint8Array(
        await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, exact.buffer as ArrayBuffer),
      );
    },
  });
  return cached;
}
