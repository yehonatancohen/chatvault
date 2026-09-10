import { useCallback, useEffect, useState } from "react";
import { ArchiveReader, type Manifest, type MergedMessage } from "@chatvault/core";
import { getCryptoProvider } from "../../lib/crypto/expo-crypto-provider";
import { WrongPassphraseError } from "../../lib/crypto/key-wrapping";
import { loadArchiveKey, storageFor, unlockWithPassphrase } from "../../lib/archive/vault";

/**
 * Opening an archive, for the three screens that read one.
 *
 * The chat, the info screen and the media grid all need the same thing and all had the same
 * forty lines: load the key, open a reader, read every message, and cope with the archive being
 * locked. Locked is a first-class state, not an error — a restored backup or another device
 * reaches it, and it is the passphrase path this product cannot afford to let rot
 * (`apps/mobile/CLAUDE.md`).
 *
 * Every screen re-reads from disk rather than sharing a cache. That is deliberate: these
 * screens exist so a user can check what the archive contains, and a cached answer is a
 * slightly different claim than a read one.
 */

export type ArchiveState =
  | { readonly kind: "loading" }
  | { readonly kind: "locked"; readonly error?: string }
  | { readonly kind: "unlocking" }
  | {
      readonly kind: "ready";
      readonly reader: ArchiveReader;
      readonly manifest: Manifest;
      readonly messages: readonly MergedMessage[];
    }
  | { readonly kind: "error"; readonly message: string };

export function useArchive(archiveId: string): {
  state: ArchiveState;
  unlock: (passphrase: string) => Promise<void>;
} {
  const [state, setState] = useState<ArchiveState>({ kind: "loading" });

  const openWith = useCallback(
    async (key: Uint8Array): Promise<void> => {
      const reader = await ArchiveReader.open({
        crypto: getCryptoProvider(),
        storage: storageFor(archiveId),
        key,
        archiveId,
      });
      const messages = await reader.readAll();
      setState({ kind: "ready", reader, manifest: reader.manifest, messages });
    },
    [archiveId],
  );

  useEffect(() => {
    let stale = false;
    void (async () => {
      try {
        const key = await loadArchiveKey(archiveId);
        if (stale) return;
        if (key === null) {
          setState({ kind: "locked" });
          return;
        }
        await openWith(key);
      } catch (error) {
        if (stale) return;
        setState({
          kind: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();
    return () => {
      stale = true;
    };
  }, [archiveId, openWith]);

  const unlock = useCallback(
    async (passphrase: string): Promise<void> => {
      setState({ kind: "unlocking" });
      try {
        await openWith(await unlockWithPassphrase(archiveId, passphrase));
      } catch (error) {
        setState({
          kind: "locked",
          error:
            error instanceof WrongPassphraseError
              ? error.message
              : error instanceof Error
                ? error.message
                : String(error),
        });
      }
    },
    [archiveId, openWith],
  );

  return { state, unlock };
}
