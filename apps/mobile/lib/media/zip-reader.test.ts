import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { bytesRandomAccess, NotAZipError, readCentralDirectory, readEntry, type RandomAccess } from "./zip-reader";

/**
 * The streaming zip reader that lifted the 150 MB export limit. The property that matters most
 * is the last one: reading one photo touches that photo's bytes, not the whole file.
 */

function noise(length: number, seed: number): Uint8Array {
  // Incompressible-ish, like a JPEG, so deflate cannot shrink it to nothing.
  const out = new Uint8Array(length);
  let x = seed;
  for (let i = 0; i < length; i += 1) {
    x = (x * 1103515245 + 12345) >>> 0;
    out[i] = x >>> 24;
  }
  return out;
}

const text = (s: string) => new TextEncoder().encode(s);

/** Counts what was read, to prove an entry read does not touch the rest of the file. */
function counting(bytes: Uint8Array): RandomAccess & { readBytes: number } {
  const inner = bytesRandomAccess(bytes);
  const counter = {
    size: inner.size,
    readBytes: 0,
    read(offset: number, length: number) {
      counter.readBytes += length;
      return inner.read(offset, length);
    },
  };
  return counter;
}

async function readAll(zip: Uint8Array): Promise<Record<string, Uint8Array>> {
  const file = bytesRandomAccess(zip);
  const out: Record<string, Uint8Array> = {};
  for (const entry of await readCentralDirectory(file)) out[entry.name] = await readEntry(file, entry);
  return out;
}

describe("zip reader", () => {
  it("reads stored and deflated entries, byte for byte", async () => {
    const photo = noise(50_000, 1);
    const zip = zipSync({
      "_chat.txt": [text("Dana: hi\n".repeat(1000)), { level: 9 }],
      "IMG-0001.jpg": [photo, { level: 0 }],
    });
    const out = await readAll(zip);
    expect(out["IMG-0001.jpg"]).toEqual(photo);
    expect(new TextDecoder().decode(out["_chat.txt"])).toBe("Dana: hi\n".repeat(1000));
  });

  it("inflates an entry larger than one read step", async () => {
    const video = noise(3 * 1024 * 1024 + 17, 2);
    const out = await readAll(zipSync({ "VID-0001.mp4": [video, { level: 6 }] }));
    // Byte comparison, not toEqual: a structural diff of 3 MB is what makes a test slow.
    expect(Buffer.compare(out["VID-0001.mp4"]!, video)).toBe(0);
  });

  it("finds the directory past a trailing archive comment", async () => {
    // Appended by hand, so the test does not depend on the zip library supporting comments.
    const plain = zipSync({ "a.jpg": noise(100, 3) });
    // It contains the end-record signature itself, well before its end, to catch a reader that
    // stops at the first match.
    const comment = text("PK\x05\x06 exported by WhatsApp, with the signature bytes in the comment");
    const zip = new Uint8Array(plain.length + comment.length);
    zip.set(plain, 0);
    zip.set(comment, plain.length);
    new DataView(zip.buffer).setUint16(plain.length - 2, comment.length, true);
    const entries = await readCentralDirectory(bytesRandomAccess(zip));
    expect(entries.map((e) => e.name)).toEqual(["a.jpg"]);
  });

  it("keeps UTF-8 names intact", async () => {
    const out = await readAll(zipSync({ "צילום-מסך.jpg": noise(10, 4) }));
    expect(Object.keys(out)).toEqual(["צילום-מסך.jpg"]);
  });

  it("reads a ZIP64 archive", async () => {
    const photo = noise(2_000, 5);
    const out = await readAll(toZip64(zipSync({ "IMG-0002.jpg": [photo, { level: 0 }], "_chat.txt": text("x") })));
    expect(out["IMG-0002.jpg"]).toEqual(photo);
    expect(new TextDecoder().decode(out["_chat.txt"])).toBe("x");
  });

  it("reads one entry without reading the rest of the file", async () => {
    const big = noise(5 * 1024 * 1024, 6);
    const zip = zipSync({ "VID-big.mp4": [big, { level: 0 }], "IMG-small.jpg": [noise(1_000, 7), { level: 0 }] });
    const file = counting(zip);
    const entries = await readCentralDirectory(file);
    const directoryCost = file.readBytes;
    await readEntry(file, entries.find((e) => e.name === "IMG-small.jpg")!);
    expect(file.readBytes - directoryCost).toBeLessThan(2_000);
    expect(directoryCost).toBeLessThan(70 * 1024); // the tail and the directory, not the video
  });

  it("says so plainly when the file is not a zip", async () => {
    await expect(readCentralDirectory(bytesRandomAccess(text("just some text, not a zip at all")))).rejects.toThrow(
      NotAZipError,
    );
  });
});

/**
 * Rewrites a small zip into ZIP64 form: overflow markers in the classic end record, plus a ZIP64
 * end record and locator carrying the real values — what a > 4 GB export looks like at its end.
 */
function toZip64(zip: Uint8Array): Uint8Array {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  const count = view.getUint16(eocd + 10, true);
  const size = view.getUint32(eocd + 12, true);
  const offset = view.getUint32(eocd + 16, true);
  const body = zip.subarray(0, eocd);

  const record = new DataView(new ArrayBuffer(56));
  record.setUint32(0, 0x06064b50, true);
  record.setBigUint64(4, 44n, true);
  record.setUint16(12, 45, true);
  record.setUint16(14, 45, true);
  record.setBigUint64(24, BigInt(count), true);
  record.setBigUint64(32, BigInt(count), true);
  record.setBigUint64(40, BigInt(size), true);
  record.setBigUint64(48, BigInt(offset), true);

  const locator = new DataView(new ArrayBuffer(20));
  locator.setUint32(0, 0x07064b50, true);
  locator.setBigUint64(8, BigInt(body.length), true);
  locator.setUint32(16, 1, true);

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, 0xffff, true);
  end.setUint16(10, 0xffff, true);
  end.setUint32(12, 0xffffffff, true);
  end.setUint32(16, 0xffffffff, true);

  const out = new Uint8Array(body.length + 56 + 20 + 22);
  out.set(body, 0);
  out.set(new Uint8Array(record.buffer), body.length);
  out.set(new Uint8Array(locator.buffer), body.length + 56);
  out.set(new Uint8Array(end.buffer), body.length + 76);
  return out;
}
