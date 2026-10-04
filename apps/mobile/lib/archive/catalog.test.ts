import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { HEADER_PATH, PLAIN_MANIFEST_PATH } from "@chatvault/core";
import { MemoryStorageAdapter } from "@chatvault/storage";
import { setDriveAccount } from "../drive/session";
import type { BackupState } from "../drive/backup-state";
const fixture = vi.hoisted(() => ({ ids: [] as string[], states: new Map<string, BackupState>(), folders: [] as { archiveId: string; folderId: string }[], remote: new Map<string, unknown>(), remotes: new Map<string, unknown>() }));
vi.mock("./vault", () => ({ listArchiveIds: () => fixture.ids }));
vi.mock("../drive/google-auth", () => ({ restoreGoogleConnection: async () => {} }));
vi.mock("../drive/backup-state", () => ({ readBackupState: async (id: string) => fixture.states.get(id) ?? { ledger: {} }, writeBackupState: (id: string, state: BackupState) => fixture.states.set(id, state) }));
vi.mock("../drive/drive-client", () => ({ driveClient: () => ({}), remotes: fixture.remotes }));
vi.mock("../crypto/expo-crypto-provider", () => ({ getCryptoProvider: () => ({ sha256: async (bytes: Uint8Array) => new Uint8Array(createHash("sha256").update(bytes).digest()) }) }));
vi.mock("@chatvault/storage", async importOriginal => {
  const actual = await importOriginal<typeof import("@chatvault/storage")>();
  return { ...actual, ensureAppFolder: async () => "root", listArchiveFolders: async () => fixture.folders,
    GoogleDriveStorageAdapter: class { constructor(options: { rootFolderId: string }) { return fixture.remote.get(options.rootFolderId) as object; } } };
});
import { pendingArchiveIds, visibleArchiveIds } from "./catalog";
import { readViewBackupState } from "./location";
async function folder(id: string, complete = true) {
  const remote = new MemoryStorageAdapter();
  await remote.put(HEADER_PATH, new Uint8Array([1]));
  if (complete) await remote.put(PLAIN_MANIFEST_PATH, new Uint8Array([2]));
  fixture.remote.set(id, remote); fixture.folders.push({ archiveId: id, folderId: id });
  return remote;
}
beforeEach(() => { fixture.ids = []; fixture.states.clear(); fixture.folders = []; fixture.remote.clear(); fixture.remotes.clear(); setDriveAccount(null); });
it("hides completed backups while signed out and preserves unassigned pending imports", async () => {
  fixture.ids = ["pending", "cloud", "legacy", "other-pending"];
  fixture.states.set("cloud", { ledger: {}, cloudOnly: true, accountEmail: "alice@example.com" });
  fixture.states.set("legacy", { ledger: {}, backedUpAt: 10 });
  fixture.states.set("other-pending", { ledger: {}, accountEmail: "alice@example.com" });
  expect(await visibleArchiveIds()).toEqual(["pending"]);
  expect(fixture.states.has("other-pending")).toBe(true);
});
it("lists only this account's pending work and discovers Drive chats automatically", async () => {
  setDriveAccount("bob@example.com");
  fixture.ids = ["alice-pending", "bob-pending"];
  fixture.states.set("alice-pending", { ledger: {}, accountEmail: "alice@example.com" });
  fixture.states.set("bob-pending", { ledger: {}, accountEmail: "bob@example.com" });
  await folder("bob-cloud"); await folder("unfinished", false);
  expect(await visibleArchiveIds()).toEqual(["bob-pending", "bob-cloud"]);
  expect(await pendingArchiveIds()).toEqual(["bob-pending"]);
  expect(fixture.states.get("bob-cloud")).toMatchObject({ accountEmail: "bob@example.com", cloudOnly: true });
});
it("can read a shared archive in a second account without taking its local pending copy", async () => {
  setDriveAccount("bob@example.com");
  fixture.ids = ["shared"];
  const state = { ledger: { old: "hash" }, accountEmail: "alice@example.com", cloudOnly: false };
  fixture.states.set("shared", state); await folder("shared");
  expect(await visibleArchiveIds()).toEqual(["shared"]);
  expect(await readViewBackupState("shared")).toMatchObject({ accountEmail: "bob@example.com", cloudOnly: true });
  expect(fixture.states.get("shared")).toEqual(state);
});
it("adopts a legacy local backup only when its recorded manifest hash matches", async () => {
  setDriveAccount("alice@example.com"); fixture.ids = ["match", "different"];
  await folder("match"); await folder("different");
  const hash = createHash("sha256").update(new Uint8Array([2])).digest("hex");
  fixture.states.set("match", { ledger: { [PLAIN_MANIFEST_PATH]: hash }, backedUpAt: 10 });
  fixture.states.set("different", { ledger: { [PLAIN_MANIFEST_PATH]: "different" }, backedUpAt: 10 });
  expect(await visibleArchiveIds()).toEqual(["match", "different"]);
  expect(fixture.states.get("match")?.accountEmail).toBe("alice@example.com");
  expect(fixture.states.get("different")?.accountEmail).toBeUndefined();
  expect(await readViewBackupState("different")).toMatchObject({ cloudOnly: true });
});
