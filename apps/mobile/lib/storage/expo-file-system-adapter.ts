/**
 * A1 — the device `StorageAdapter`.
 *
 * `packages/storage/CLAUDE.md`: "the device adapter lives in `apps/mobile` because it needs
 * Expo's filesystem." Everything it sees is already ciphertext, one object at a time — the
 * archive layer never hands this adapter more than a single chunk or media blob, so unlike the
 * export-zip reader (`../media/zip-media-source.ts`) there is no whole-archive-in-memory risk
 * here to design around.
 *
 * Built against `expo-file-system`'s SDK 57 `File`/`Directory` API (the same one
 * `app/import.tsx` already uses for Step 0). That API is a native module — it cannot run
 * under Node, so unlike every other adapter in this codebase it **cannot run through
 * `runStorageConformance` in CI**. `packages/storage/CLAUDE.md` calls that suite non-optional,
 * and it still is: it just has to run from a screen in this app, on a device, once Step 0's
 * build exists. Until then this is unverified in the same sense the Share Extension is —
 * typechecking is not evidence it works.
 */

import { Directory, File } from "expo-file-system";
import { ObjectNotFoundError, type StorageAdapter, type StorageCapabilities } from "@chatvault/storage";

export class ExpoFileSystemStorageAdapter implements StorageAdapter {
  readonly id = "local";

  private readonly root: Directory;

  constructor(root: Directory) {
    this.root = root;
  }

  private fileFor(path: string): File {
    return new File(this.root, ...path.split("/"));
  }

  async put(path: string, data: Uint8Array): Promise<void> {
    const file = this.fileFor(path);
    // `idempotent` because two archives can legitimately share a parent directory (e.g. two
    // chunks under `chunks/`) — only the first `put` needs to create it, and the contract
    // doesn't say which write happens first.
    file.parentDirectory.create({ intermediates: true, idempotent: true });
    file.write(data);
  }

  async get(path: string): Promise<Uint8Array> {
    const file = this.fileFor(path);
    if (!file.exists) throw new ObjectNotFoundError(path);
    return file.bytes();
  }

  async has(path: string): Promise<boolean> {
    return this.fileFor(path).exists;
  }

  async list(prefix: string): Promise<string[]> {
    if (!this.root.exists) return [];
    const results: string[] = [];
    walk(this.root, "", results);
    return results.filter((path) => path.startsWith(prefix));
  }

  async remove(path: string): Promise<void> {
    const file = this.fileFor(path);
    // Removing a missing object is not an error — see `conformance.ts`. `File.delete()`
    // throws when the file is absent, so absence has to be checked first rather than caught.
    if (file.exists) file.delete();
  }

  capabilities(): StorageCapabilities {
    // Device storage is exactly the iCloud case `packages/storage/CLAUDE.md` warns about:
    // reachable from this app on this device, and nowhere else — not the web viewer, not
    // another platform. `webReadable: false` is what makes the destination picker say so.
    return { streaming: true, webReadable: false };
  }

  async putStream(path: string, data: AsyncIterable<Uint8Array>): Promise<void> {
    const file = this.fileFor(path);
    file.parentDirectory.create({ intermediates: true, idempotent: true });
    const writer = file.writableStream().getWriter();
    try {
      for await (const chunk of data) await writer.write(chunk);
    } finally {
      await writer.close();
    }
  }

  async *getStream(path: string): AsyncIterable<Uint8Array> {
    const file = this.fileFor(path);
    if (!file.exists) throw new ObjectNotFoundError(path);
    const reader = file.readableStream().getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        if (value) yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }
}

/** `Directory.list()` is one level deep; the archive's `chunks/`, `media/` need a recursive walk. */
function walk(dir: Directory, relBase: string, out: string[]): void {
  for (const entry of dir.list()) {
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry instanceof Directory) {
      walk(entry, rel, out);
    } else {
      out.push(rel);
    }
  }
}
