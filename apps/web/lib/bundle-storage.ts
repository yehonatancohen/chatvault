/**
 * The `.cvault` bundle: a `.cvault` file is a zip of exactly what `ArchiveStoragePort` would
 * hold — `header.json`, `manifest.json.enc`, `chunks/*.jsonl.enc`, `media/*.enc`,
 * `index.json.enc`. This is what B0a hands around: a member receives it by AirDrop, email or
 * a Drive share, and this module is the only place that knows it is a zip underneath.
 *
 * `core` never sees this file directly — it only sees an `ArchiveStoragePort`, satisfied here
 * by an in-memory map seeded from the opened zip. That keeps the zip format entirely a web
 * concern, same reasoning as `MediaSource` in `apps/mobile/CLAUDE.md`.
 *
 * Everything here is plaintext-of-ciphertext, i.e. still sealed: unzipping a bundle reveals
 * paths and sizes, never message content. See `archive/format.ts`'s note on what the on-disk
 * shape is allowed to leak.
 */

import { unzip, zip, type Unzipped, type Zippable } from "fflate";
import type { ArchiveStoragePort } from "@chatvault/core";

export class BundleStorage implements ArchiveStoragePort {
  private readonly files = new Map<string, Uint8Array>();

  private constructor(entries: Iterable<readonly [string, Uint8Array]>) {
    for (const [path, bytes] of entries) this.files.set(path, bytes);
  }

  static async open(file: File): Promise<BundleStorage> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const unzipped = await unzipAsync(bytes);
    return new BundleStorage(Object.entries(unzipped));
  }

  put(path: string, data: Uint8Array): Promise<void> {
    this.files.set(path, data);
    return Promise.resolve();
  }

  get(path: string): Promise<Uint8Array> {
    const bytes = this.files.get(path);
    if (bytes === undefined) return Promise.reject(new Error(`No object at ${path} in bundle`));
    return Promise.resolve(bytes);
  }

  has(path: string): Promise<boolean> {
    return Promise.resolve(this.files.has(path));
  }

  /** Every path currently held, for rendering a bundle's contents or exporting it back out. */
  paths(): readonly string[] {
    return [...this.files.keys()];
  }

  /** Zips the current contents back into a downloadable `.cvault` file. */
  async toBlob(): Promise<Blob> {
    const zippable: Zippable = {};
    for (const [path, bytes] of this.files) zippable[path] = bytes;
    const zipped = await zipAsync(zippable);
    return new Blob([new Uint8Array(zipped)], { type: "application/octet-stream" });
  }
}

function unzipAsync(bytes: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    unzip(bytes, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

function zipAsync(files: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data)));
  });
}
