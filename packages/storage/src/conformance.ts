import { describe, it } from "vitest";
import type { StorageAdapter } from "./adapter.js";
import { isContractSkip, storageContract } from "./contract.js";

/**
 * The contract every adapter must satisfy, run under vitest.
 *
 * The cases themselves live in `contract.ts` and carry their own assertions — this file is only
 * the Node runner. That split exists because `ExpoFileSystemStorageAdapter` cannot run under
 * vitest at all (`File`/`Directory` are a native module), and an adapter that cannot run the
 * suite is an adapter nobody has checked. `runStorageContract` is the other runner; both walk
 * the same array, so there is still exactly one contract.
 *
 * Each adapter's test file calls this: `runStorageConformance("GoogleDriveAdapter", () => new
 * GoogleDriveAdapter(...))`. Do not hand-write per-adapter tests instead — the point is that a
 * Drive adapter and the in-memory one are proven to behave identically.
 */
export function runStorageConformance(
  name: string,
  createAdapter: () => StorageAdapter,
): void {
  describe(`StorageAdapter contract: ${name}`, () => {
    for (const testCase of storageContract) {
      it(testCase.name, async ({ skip }) => {
        try {
          await testCase.run(createAdapter());
        } catch (error) {
          // A case that does not apply (streaming, on an adapter that declares none) is
          // reported as skipped rather than swallowed, so the suite says what it did not check.
          if (isContractSkip(error)) skip(error instanceof Error ? error.message : undefined);
          else throw error;
        }
      });
    }
  });
}
