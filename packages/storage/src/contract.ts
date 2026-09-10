/**
 * The `StorageAdapter` contract, as data rather than as a test file.
 *
 * `conformance.ts` used to *be* the contract, written directly against vitest's `describe`/`it`.
 * That made it unrunnable for the one adapter that most needs it: `ExpoFileSystemStorageAdapter`
 * is built on a native module, so it can only be exercised inside the Expo runtime, where there
 * is no vitest and no test runner at all. An adapter that cannot run the suite is an adapter
 * nobody has checked — and this one is about to be trusted with a user's only copy of a chat.
 *
 * So the cases live here as plain async functions with their own assertions, and two thin
 * runners sit on top:
 *
 * - `conformance.ts` wraps them in vitest for Node (`pnpm test`).
 * - `runStorageContract` runs them anywhere else and returns results — which is how a dev screen
 *   in `apps/mobile` runs this exact suite on a physical device.
 *
 * There is still only one contract. Adding a case here adds it to every adapter, in both places.
 *
 * Nothing in this file may import a test framework, `node:*`, or a DOM global: it runs under
 * Hermes. Same rule as `packages/core` (root `CLAUDE.md`, invariant 3), for the same reason.
 */

import { ObjectNotFoundError, type StorageAdapter } from "./adapter.js";

export interface ContractCase {
  readonly name: string;
  /**
   * Receives a *fresh, empty* adapter. Cases assume they start from nothing — on a filesystem
   * adapter that means a directory of its own, since files outlive the object that wrote them.
   */
  run(adapter: StorageAdapter): Promise<void>;
}

export type ContractStatus = "passed" | "failed" | "skipped";

export interface ContractResult {
  readonly name: string;
  readonly status: ContractStatus;
  /** Present when `status` is `"failed"` (the assertion) or `"skipped"` (the reason). */
  readonly detail?: string;
  readonly durationMs: number;
}

/** ASCII to bytes, without `TextEncoder` — not every JS runtime this must run in has one. */
function bytes(ascii: string): Uint8Array {
  const out = new Uint8Array(ascii.length);
  for (let i = 0; i < ascii.length; i += 1) out[i] = ascii.charCodeAt(i) & 0xff;
  return out;
}

class ContractViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractViolation";
  }
}

/** Marker for a case that does not apply to this adapter — reported, never silently dropped. */
class ContractSkip extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractSkip";
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new ContractViolation(message);
}

function describeBytes(value: Uint8Array): string {
  const head = [...value.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join(" ");
  return `${value.byteLength} bytes [${head}${value.byteLength > 12 ? " ..." : ""}]`;
}

function assertBytes(actual: Uint8Array, expected: Uint8Array, what: string): void {
  assert(
    actual instanceof Uint8Array,
    `${what}: expected a Uint8Array, got ${Object.prototype.toString.call(actual)}`,
  );
  assert(
    actual.byteLength === expected.byteLength,
    `${what}: expected ${expected.byteLength} bytes, got ${actual.byteLength}`,
  );
  for (let i = 0; i < expected.byteLength; i += 1) {
    assert(
      actual[i] === expected[i],
      `${what}: byte ${i} is ${actual[i]}, expected ${expected[i]} ` +
        `(got ${describeBytes(actual)}, wanted ${describeBytes(expected)})`,
    );
  }
}

function assertPaths(actual: readonly string[], expected: readonly string[], what: string): void {
  const got = [...actual].sort();
  const want = [...expected].sort();
  assert(
    got.length === want.length && got.every((p, i) => p === want[i]),
    `${what}: got [${got.join(", ")}], expected [${want.join(", ")}]`,
  );
}

async function collect(stream: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of stream) {
    chunks.push(chunk);
    total += chunk.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * The executable contract.
 *
 * Each case covers something that differs quietly between backends and would otherwise surface
 * months later inside a user's archive: buffer aliasing, overwrite semantics, prefix listing,
 * binary safety, missing-object behaviour, idempotent delete.
 */
export const storageContract: readonly ContractCase[] = [
  {
    name: "round-trips an object",
    async run(adapter) {
      await adapter.put("chunks/0.jsonl.enc", bytes("sealed"));
      assertBytes(await adapter.get("chunks/0.jsonl.enc"), bytes("sealed"), "get after put");
    },
  },
  {
    name: "reports presence without reading",
    async run(adapter) {
      assert((await adapter.has("manifest.json.enc")) === false, "has() was true before put");
      await adapter.put("manifest.json.enc", bytes("m"));
      assert((await adapter.has("manifest.json.enc")) === true, "has() was false after put");
    },
  },
  {
    name: "rejects with ObjectNotFoundError for a missing path",
    async run(adapter) {
      let thrown: unknown;
      try {
        await adapter.get("nope");
      } catch (error) {
        thrown = error;
      }
      assert(thrown !== undefined, "get() on a missing path resolved instead of rejecting");
      assert(
        thrown instanceof ObjectNotFoundError,
        `get() on a missing path rejected with ${String(thrown)}, not ObjectNotFoundError`,
      );
    },
  },
  {
    name: "overwrites in place",
    async run(adapter) {
      await adapter.put("manifest.json.enc", bytes("first"));
      await adapter.put("manifest.json.enc", bytes("second"));
      assertBytes(await adapter.get("manifest.json.enc"), bytes("second"), "after overwrite");
    },
  },
  {
    name: "overwrites with shorter content, leaving no tail behind",
    async run(adapter) {
      // A filesystem adapter that opens for write without truncating leaves the tail of the
      // longer value in place. The result is a chunk that decrypts to garbage, months later.
      await adapter.put("manifest.json.enc", bytes("a much longer first value"));
      await adapter.put("manifest.json.enc", bytes("short"));
      assertBytes(await adapter.get("manifest.json.enc"), bytes("short"), "after shrinking write");
    },
  },
  {
    name: "lists by prefix and nothing else",
    async run(adapter) {
      await adapter.put("chunks/0.jsonl.enc", bytes("a"));
      await adapter.put("chunks/1.jsonl.enc", bytes("b"));
      await adapter.put("media/abc.enc", bytes("c"));

      assertPaths(
        await adapter.list("chunks/"),
        ["chunks/0.jsonl.enc", "chunks/1.jsonl.enc"],
        "list('chunks/')",
      );
      assertPaths(await adapter.list("media/"), ["media/abc.enc"], "list('media/')");
      assertPaths(await adapter.list("nothing/"), [], "list('nothing/')");
    },
  },
  {
    name: "lists everything under an empty prefix",
    async run(adapter) {
      // `ArchiveReader` enumerates a whole archive this way, and a filesystem adapter has to
      // recurse to answer it — a one-level directory listing passes every other list case.
      await adapter.put("header.json", bytes("h"));
      await adapter.put("chunks/0.jsonl.enc", bytes("a"));
      await adapter.put("media/abc.enc", bytes("c"));

      assertPaths(
        await adapter.list(""),
        ["header.json", "chunks/0.jsonl.enc", "media/abc.enc"],
        "list('')",
      );
    },
  },
  {
    name: "lists nothing before anything is written",
    async run(adapter) {
      // On a filesystem adapter the root directory may not exist yet; that is not an error.
      assertPaths(await adapter.list(""), [], "list('') on an empty adapter");
    },
  },
  {
    name: "removes, and removing a missing object is not an error",
    async run(adapter) {
      await adapter.put("media/abc.enc", bytes("c"));
      await adapter.remove("media/abc.enc");
      assert((await adapter.has("media/abc.enc")) === false, "has() true after remove");
      // Idempotent: retrying a partially-failed cleanup must not throw.
      await adapter.remove("media/abc.enc");
    },
  },
  {
    name: "does not alias the caller's buffer",
    async run(adapter) {
      const mutable = bytes("original");
      await adapter.put("chunks/0.jsonl.enc", mutable);
      mutable.set([0x00], 0);

      assertBytes(await adapter.get("chunks/0.jsonl.enc"), bytes("original"), "after caller mutation");
    },
  },
  {
    name: "preserves arbitrary binary, not just text",
    async run(adapter) {
      // Everything this layer stores is ciphertext, so a backend that round-trips text but
      // mangles high bytes, NULs or CRLF corrupts every archive it touches.
      const binary = Uint8Array.from([0x00, 0xff, 0x0a, 0x0d, 0x80, 0x1a]);
      await adapter.put("media/bin.enc", binary);
      assertBytes(await adapter.get("media/bin.enc"), binary, "binary round-trip");
    },
  },
  {
    name: "round-trips an empty object",
    async run(adapter) {
      await adapter.put("chunks/empty.enc", new Uint8Array(0));
      assert(await adapter.has("chunks/empty.enc"), "an empty object did not exist after put");
      assertBytes(await adapter.get("chunks/empty.enc"), new Uint8Array(0), "empty round-trip");
    },
  },
  {
    name: "declares whether the web client can read it",
    async run(adapter) {
      const capabilities = adapter.capabilities();
      assert(typeof capabilities.webReadable === "boolean", "webReadable is not a boolean");
      assert(typeof capabilities.streaming === "boolean", "streaming is not a boolean");
    },
  },
  {
    name: "streams: implements putStream/getStream when it claims streaming",
    async run(adapter) {
      if (!adapter.capabilities().streaming) throw new ContractSkip("capabilities().streaming is false");
      assert(
        typeof adapter.putStream === "function" && typeof adapter.getStream === "function",
        "capabilities().streaming is true but putStream/getStream are missing — callers branch " +
          "on that flag and will call methods that do not exist",
      );
    },
  },
  {
    name: "streams: a streamed write reads back whole, by get and by getStream",
    async run(adapter) {
      if (!adapter.capabilities().streaming) throw new ContractSkip("capabilities().streaming is false");
      const putStream = adapter.putStream;
      const getStream = adapter.getStream;
      assert(putStream !== undefined && getStream !== undefined, "streaming methods missing");

      // Deliberately several chunks, one of them empty, with binary bytes: media arrives from
      // an unzip in whatever chunk sizes the reader felt like.
      const parts = [
        Uint8Array.from([0x00, 0x01, 0x02]),
        new Uint8Array(0),
        Uint8Array.from([0xff, 0x80, 0x0a, 0x0d]),
      ];
      const whole = Uint8Array.from([0x00, 0x01, 0x02, 0xff, 0x80, 0x0a, 0x0d]);

      await putStream.call(adapter, "media/streamed.enc", (async function* () {
        for (const part of parts) yield part;
      })());

      assertBytes(await adapter.get("media/streamed.enc"), whole, "get() after putStream");
      assertBytes(
        await collect(getStream.call(adapter, "media/streamed.enc")),
        whole,
        "getStream() after putStream",
      );
    },
  },
  {
    name: "streams: getStream on a missing path fails with ObjectNotFoundError",
    async run(adapter) {
      if (!adapter.capabilities().streaming) throw new ContractSkip("capabilities().streaming is false");
      const getStream = adapter.getStream;
      assert(getStream !== undefined, "streaming methods missing");

      let thrown: unknown;
      try {
        // An async generator does not run until iterated, so the failure has to be provoked.
        await collect(getStream.call(adapter, "nope"));
      } catch (error) {
        thrown = error;
      }
      assert(thrown !== undefined, "getStream() on a missing path yielded instead of failing");
      assert(
        thrown instanceof ObjectNotFoundError,
        `getStream() on a missing path failed with ${String(thrown)}, not ObjectNotFoundError`,
      );
    },
  },
];

export function isContractSkip(error: unknown): boolean {
  return error instanceof ContractSkip;
}

/**
 * Runs the contract outside a test framework and reports what happened.
 *
 * `createAdapter` must hand back a *fresh, empty* adapter each call — for a filesystem adapter
 * that means a fresh directory, not just a fresh object.
 *
 * Never throws: a runner that dies on the first failure is useless on a device, where the whole
 * point is to read every result off one screen.
 */
export async function runStorageContract(
  createAdapter: (caseName: string) => StorageAdapter | Promise<StorageAdapter>,
): Promise<readonly ContractResult[]> {
  const results: ContractResult[] = [];

  for (const testCase of storageContract) {
    const started = Date.now();
    try {
      const adapter = await createAdapter(testCase.name);
      await testCase.run(adapter);
      results.push({ name: testCase.name, status: "passed", durationMs: Date.now() - started });
    } catch (error) {
      results.push({
        name: testCase.name,
        status: isContractSkip(error) ? "skipped" : "failed",
        detail: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - started,
      });
    }
  }

  return results;
}
