/**
 * Reading a zip one entry at a time, from a file that is never loaded whole.
 *
 * This replaces `fflate.unzipSync` over the entire export, which put the whole zip in memory and
 * is why exports were capped at 150 MB. Here the central directory — the zip's table of contents,
 * at its end — is read once; each entry is then read by seeking to it and inflating it on its
 * own. Peak memory is about one entry's uncompressed size, whatever the export's size.
 *
 * Handles what WhatsApp exports can contain: stored and deflated entries, entries whose sizes
 * come after their data (general-purpose bit 3 — the central directory has the real sizes, so
 * the local header's are ignored), a trailing archive comment, and ZIP64 for exports past 4 GB
 * or 65,535 entries. Anything else (encryption, other compression methods) is refused by name.
 *
 * Pure JS over a `RandomAccess` port, so it runs under Node in tests and over an
 * `expo-file-system` `FileHandle` on the phone (`openRandomAccess`).
 */

import { Inflate } from "fflate";
import { decodeUtf8 } from "@chatvault/core";

export interface RandomAccess {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}

export interface ZipEntry {
  readonly name: string;
  readonly method: number;
  readonly compressedSize: number;
  readonly uncompressedSize: number;
  readonly localHeaderOffset: number;
  readonly encrypted: boolean;
}

export class NotAZipError extends Error {
  constructor(detail: string) {
    super(`This file is not a readable zip: ${detail}`);
    this.name = "NotAZipError";
  }
}

const EOCD = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_EOCD = 0x06064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const MAX_COMMENT = 0xffff;
/** How much compressed data is read per step when inflating. */
const READ_STEP = 1024 * 1024;

export async function readCentralDirectory(file: RandomAccess): Promise<ZipEntry[]> {
  const tailLength = Math.min(file.size, 22 + MAX_COMMENT);
  if (tailLength < 22) throw new NotAZipError("too short");
  const tailStart = file.size - tailLength;
  const tail = await file.read(tailStart, tailLength);

  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i -= 1) {
    // A real end record's comment runs exactly to the end of the file; the same four bytes
    // appearing inside a comment do not.
    if (u32(tail, i) === EOCD && u16(tail, i + 20) === tail.length - i - 22) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new NotAZipError("no end-of-central-directory record");

  let count = u16(tail, eocd + 10);
  let size = u32(tail, eocd + 12);
  let offset = u32(tail, eocd + 16);

  const needs64 = count === 0xffff || size === 0xffffffff || offset === 0xffffffff;
  if (needs64 && eocd >= 20 && u32(tail, eocd - 20) === ZIP64_LOCATOR) {
    const recordOffset = u64(tail, eocd - 20 + 8);
    const record = await file.read(recordOffset, 56);
    if (u32(record, 0) !== ZIP64_EOCD) throw new NotAZipError("bad ZIP64 record");
    count = u64(record, 32);
    size = u64(record, 40);
    offset = u64(record, 48);
  }

  const directory = await file.read(offset, size);
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let n = 0; n < count; n += 1) {
    if (u32(directory, p) !== CENTRAL) throw new NotAZipError(`bad central entry ${n}`);
    const flags = u16(directory, p + 8);
    const method = u16(directory, p + 10);
    let compressedSize = u32(directory, p + 20);
    let uncompressedSize = u32(directory, p + 24);
    const nameLength = u16(directory, p + 28);
    const extraLength = u16(directory, p + 30);
    const commentLength = u16(directory, p + 32);
    let localHeaderOffset = u32(directory, p + 42);
    const name = decodeUtf8(directory.subarray(p + 46, p + 46 + nameLength));

    // ZIP64 extended information: present for exactly the fields that overflowed, in this order.
    let e = p + 46 + nameLength;
    const extraEnd = e + extraLength;
    while (e + 4 <= extraEnd) {
      const id = u16(directory, e);
      const length = u16(directory, e + 2);
      if (id === 0x0001) {
        let f = e + 4;
        if (uncompressedSize === 0xffffffff) {
          uncompressedSize = u64(directory, f);
          f += 8;
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = u64(directory, f);
          f += 8;
        }
        if (localHeaderOffset === 0xffffffff) localHeaderOffset = u64(directory, f);
      }
      e += 4 + length;
    }

    entries.push({
      name,
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      encrypted: (flags & 0x1) !== 0,
    });
    p = extraEnd + commentLength;
  }
  return entries;
}

/** One entry's contents, inflated. Memory: the uncompressed entry plus one read step. */
export async function readEntry(file: RandomAccess, entry: ZipEntry): Promise<Uint8Array> {
  if (entry.encrypted) throw new NotAZipError(`${entry.name} is encrypted`);

  const header = await file.read(entry.localHeaderOffset, 30);
  if (u32(header, 0) !== LOCAL) throw new NotAZipError(`bad local header for ${entry.name}`);
  const dataStart = entry.localHeaderOffset + 30 + u16(header, 26) + u16(header, 28);

  if (entry.method === 0) return file.read(dataStart, entry.compressedSize);
  if (entry.method !== 8) throw new NotAZipError(`${entry.name} uses compression method ${entry.method}`);

  const out = new Uint8Array(entry.uncompressedSize);
  let written = 0;
  const inflate = new Inflate((chunk) => {
    if (written + chunk.length > out.length) throw new NotAZipError(`${entry.name} inflates past its size`);
    out.set(chunk, written);
    written += chunk.length;
  });
  for (let read = 0; read < entry.compressedSize; read += READ_STEP) {
    const length = Math.min(READ_STEP, entry.compressedSize - read);
    const piece = await file.read(dataStart + read, length);
    inflate.push(piece, read + length >= entry.compressedSize);
  }
  if (entry.compressedSize === 0) inflate.push(new Uint8Array(0), true);
  if (written !== out.length) throw new NotAZipError(`${entry.name} is truncated`);
  return out;
}

/** An in-memory `RandomAccess`, for tests and for small inputs already held as bytes. */
export function bytesRandomAccess(bytes: Uint8Array): RandomAccess {
  return {
    size: bytes.length,
    // A copy, not a view: callers may keep or change what they are handed.
    read: (offset, length) => Promise.resolve(bytes.slice(offset, offset + length)),
  };
}

function u16(b: Uint8Array, i: number): number {
  return b[i]! | (b[i + 1]! << 8);
}

function u32(b: Uint8Array, i: number): number {
  return (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
}

/** A little-endian 64-bit value as a JS number — exact up to 2^53, far past any export. */
function u64(b: Uint8Array, i: number): number {
  return u32(b, i) + u32(b, i + 4) * 0x1_0000_0000;
}
