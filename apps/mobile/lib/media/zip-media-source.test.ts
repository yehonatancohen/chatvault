import { zipSync } from "fflate";
import { MediaNotFoundError } from "@chatvault/core";
import { describe, expect, it } from "vitest";
import {
  MAX_SAFE_ZIP_BYTES,
  NoTranscriptError,
  ZipMediaSource,
  ZipTooLargeError,
} from "./zip-media-source";

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function makeExportZip(): Uint8Array {
  return zipSync({
    "_chat.txt": bytes("[3/14/25, 8:10:12 PM] Dana: hi"),
    "00000043-PHOTO-2025-03-14-20-10-34.jpg": bytes("fake jpeg bytes"),
    "00000049-STICKER-2025-03-15-15-48-45.webp": bytes("fake webp bytes"),
    ".DS_Store": bytes("apple junk"),
    "__MACOSX/._00000043-PHOTO-2025-03-14-20-10-34.jpg": bytes("resource fork junk"),
  });
}

describe("ZipMediaSource", () => {
  it("lists media candidates only — no transcript, no OS debris", async () => {
    const source = new ZipMediaSource(makeExportZip());
    expect([...(await source.list())].sort()).toEqual([
      "00000043-PHOTO-2025-03-14-20-10-34.jpg",
      "00000049-STICKER-2025-03-15-15-48-45.webp",
    ]);
  });

  it("reads a listed file's exact bytes", async () => {
    const source = new ZipMediaSource(makeExportZip());
    expect(await source.read("00000043-PHOTO-2025-03-14-20-10-34.jpg")).toEqual(
      bytes("fake jpeg bytes"),
    );
  });

  it("rejects with MediaNotFoundError for a name not in the zip", async () => {
    const source = new ZipMediaSource(makeExportZip());
    await expect(source.read("nope.jpg")).rejects.toBeInstanceOf(MediaNotFoundError);
  });

  it("reads the transcript that list() deliberately hides", async () => {
    const source = new ZipMediaSource(makeExportZip());
    expect(await source.readTranscript()).toBe("[3/14/25, 8:10:12 PM] Dana: hi");
  });

  it("decodes a Hebrew transcript as UTF-8, bidi marks intact", async () => {
    // The parser's whole difficulty is invisible characters (root CLAUDE.md); a transcript
    // reader that mangled them would break parsing in a way no fixture here would catch.
    const line = "[14/03/2025, 20:10:34] דנה: תראה מה מצאתי ‎<attached: a.jpg>";
    const source = new ZipMediaSource(zipSync({ "_chat.txt": bytes(line) }));
    expect(await source.readTranscript()).toBe(line);
  });

  it("finds the transcript under a folder, as some exports nest it", async () => {
    const source = new ZipMediaSource(
      zipSync({ "WhatsApp Chat - Dana/_chat.txt": bytes("hello"), "a.jpg": bytes("x") }),
    );
    expect(await source.readTranscript()).toBe("hello");
  });

  it("does not mistake a macOS resource fork for the transcript", async () => {
    const source = new ZipMediaSource(
      zipSync({ "__MACOSX/._chat.txt": bytes("junk"), "_chat.txt": bytes("real") }),
    );
    expect(await source.readTranscript()).toBe("real");
  });

  it("says so plainly when a zip is not an export at all", async () => {
    const source = new ZipMediaSource(zipSync({ "photo.jpg": bytes("x") }));
    await expect(source.readTranscript()).rejects.toBeInstanceOf(NoTranscriptError);
  });

  it("does not decompress entries it does not return — read() only inflates the match", async () => {
    // Two entries; ask for one. If `filter` were inflating everything regardless, this would
    // still pass — the real regression this guards is `list()` never calling into inflate at
    // all, which a corrupted-compression entry proves indirectly: list() must not throw even
    // when an untouched entry could not be decompressed.
    const zip = zipSync({
      "_chat.txt": bytes("irrelevant"),
      "good.jpg": bytes("readable"),
    });
    const source = new ZipMediaSource(zip);
    await expect(source.list()).resolves.toEqual(["good.jpg"]);
    await expect(source.read("good.jpg")).resolves.toEqual(bytes("readable"));
  });

  it("refuses a zip over the safe in-memory ceiling", () => {
    const oversized = new Uint8Array(MAX_SAFE_ZIP_BYTES + 1);
    expect(() => new ZipMediaSource(oversized)).toThrow(ZipTooLargeError);
  });

  it("caches the listing rather than re-scanning on every call", async () => {
    const source = new ZipMediaSource(makeExportZip());
    const first = await source.list();
    const second = await source.list();
    expect(second).toBe(first); // same array reference: proof the cache path was taken
  });
});
