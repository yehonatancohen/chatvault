import { describe, expect, it } from "vitest";
import { ObjectNotFoundError, type StorageAdapter } from "./adapter.js";

/**
 * The contract every adapter must satisfy.
 *
 * Exported so each adapter's own test file can run it — `runStorageConformance(() => new
 * GoogleDriveAdapter(...))`. A Drive or iCloud adapter that quietly behaves differently from
 * the in-memory one is the kind of bug that only shows up in a user's archive months later,
 * so the contract is executable rather than written down.
 */
export function runStorageConformance(
  name: string,
  createAdapter: () => StorageAdapter,
): void {
  const bytes = (s: string): Uint8Array => new TextEncoder().encode(s);

  describe(`StorageAdapter contract: ${name}`, () => {
    it("round-trips an object", async () => {
      const adapter = createAdapter();
      await adapter.put("chunks/0.jsonl.enc", bytes("sealed"));
      expect(await adapter.get("chunks/0.jsonl.enc")).toEqual(bytes("sealed"));
    });

    it("reports presence without reading", async () => {
      const adapter = createAdapter();
      expect(await adapter.has("manifest.json.enc")).toBe(false);
      await adapter.put("manifest.json.enc", bytes("m"));
      expect(await adapter.has("manifest.json.enc")).toBe(true);
    });

    it("rejects with ObjectNotFoundError for a missing path", async () => {
      const adapter = createAdapter();
      await expect(adapter.get("nope")).rejects.toBeInstanceOf(ObjectNotFoundError);
    });

    it("overwrites in place", async () => {
      const adapter = createAdapter();
      await adapter.put("manifest.json.enc", bytes("first"));
      await adapter.put("manifest.json.enc", bytes("second"));
      expect(await adapter.get("manifest.json.enc")).toEqual(bytes("second"));
    });

    it("lists by prefix and nothing else", async () => {
      const adapter = createAdapter();
      await adapter.put("chunks/0.jsonl.enc", bytes("a"));
      await adapter.put("chunks/1.jsonl.enc", bytes("b"));
      await adapter.put("media/abc.enc", bytes("c"));

      expect((await adapter.list("chunks/")).sort()).toEqual([
        "chunks/0.jsonl.enc",
        "chunks/1.jsonl.enc",
      ]);
      expect(await adapter.list("media/")).toEqual(["media/abc.enc"]);
      expect(await adapter.list("nothing/")).toEqual([]);
    });

    it("removes, and removing a missing object is not an error", async () => {
      const adapter = createAdapter();
      await adapter.put("media/abc.enc", bytes("c"));
      await adapter.remove("media/abc.enc");
      expect(await adapter.has("media/abc.enc")).toBe(false);
      // Idempotent: retrying a partially-failed cleanup must not throw.
      await expect(adapter.remove("media/abc.enc")).resolves.toBeUndefined();
    });

    it("does not alias the caller's buffer", async () => {
      const adapter = createAdapter();
      const mutable = bytes("original");
      await adapter.put("chunks/0.jsonl.enc", mutable);
      mutable.set([0x00], 0);

      expect(await adapter.get("chunks/0.jsonl.enc")).toEqual(bytes("original"));
    });

    it("preserves arbitrary binary, not just text", async () => {
      const adapter = createAdapter();
      const binary = Uint8Array.from([0x00, 0xff, 0x0a, 0x0d, 0x80, 0x1a]);
      await adapter.put("media/bin.enc", binary);
      expect(await adapter.get("media/bin.enc")).toEqual(binary);
    });

    it("declares whether the web client can read it", () => {
      const capabilities = createAdapter().capabilities();
      expect(typeof capabilities.webReadable).toBe("boolean");
      expect(typeof capabilities.streaming).toBe("boolean");
    });
  });
}
