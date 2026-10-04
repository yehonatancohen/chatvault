import { beforeEach, expect, it, vi } from "vitest";
import { MemoryStorageAdapter } from "@chatvault/storage";
import { accountEmail, sessionGeneration, setDriveAccount } from "../drive/session";
const fixture = vi.hoisted(() => ({ state: {} as { accountEmail?: string; cloudOnly?: boolean; backedUpAt?: number }, local: undefined as unknown, remote: undefined as unknown }));
vi.mock("./vault", () => ({ storageFor: () => fixture.local }));
vi.mock("./location", () => ({ readViewBackupState: async () => fixture.state }));
vi.mock("../drive/drive-client", () => ({ remoteFor: async () => fixture.remote }));
import { readableStorageFor } from "./readable-storage";
beforeEach(() => { fixture.local = new MemoryStorageAdapter(); fixture.remote = new MemoryStorageAdapter(); fixture.state = {}; setDriveAccount(null); });
it("reads cloud content even when stale local messages still exist", async () => {
  setDriveAccount("alice@example.com");
  fixture.state = { accountEmail: accountEmail()!, cloudOnly: true };
  await (fixture.local as MemoryStorageAdapter).put("chunks/a", new Uint8Array([1]));
  await (fixture.remote as MemoryStorageAdapter).put("chunks/a", new Uint8Array([2]));
  expect(await readableStorageFor("chat").get("chunks/a")).toEqual(new Uint8Array([2]));
});
it("keeps an unassigned pending import readable while signed out", async () => {
  await (fixture.local as MemoryStorageAdapter).put("chunks/a", new Uint8Array([1]));
  expect(await readableStorageFor("chat").get("chunks/a")).toEqual(new Uint8Array([1]));
});
it("rejects old readers and clears cached bytes after disconnect and account change", async () => {
  setDriveAccount("alice@example.com"); fixture.state = { accountEmail: "alice@example.com", cloudOnly: true };
  await (fixture.remote as MemoryStorageAdapter).put("thumbs/a", new Uint8Array([1]));
  const old = readableStorageFor("chat");
  expect(await old.get("thumbs/a")).toEqual(new Uint8Array([1]));
  const generation = sessionGeneration();
  setDriveAccount(null);
  await expect(old.get("thumbs/a")).rejects.toThrow("account changed");
  setDriveAccount("bob@example.com"); fixture.state = { accountEmail: "bob@example.com", cloudOnly: true };
  await (fixture.remote as MemoryStorageAdapter).put("thumbs/a", new Uint8Array([2]));
  expect(sessionGeneration()).toBeGreaterThan(generation);
  expect(await readableStorageFor("chat").get("thumbs/a")).toEqual(new Uint8Array([2]));
});
it("prevents reading another account's unfinished local import", async () => {
  setDriveAccount("bob@example.com"); fixture.state = { accountEmail: "alice@example.com" };
  await expect(readableStorageFor("chat").get("chunks/a")).rejects.toThrow("owns this chat");
});
it("does not return a download that completes after sign-out", async () => {
  setDriveAccount("alice@example.com"); fixture.state = { accountEmail: "alice@example.com", cloudOnly: true };
  fixture.remote = { get: async () => { setDriveAccount(null); return new Uint8Array([1]); } };
  await expect(readableStorageFor("chat").get("chunks/a")).rejects.toThrow("account changed");
});

it("reads changed remote message chunks after an append instead of caching old messages", async () => {
  setDriveAccount("alice@example.com"); fixture.state = { accountEmail: "alice@example.com", cloudOnly: true };
  const remote = fixture.remote as MemoryStorageAdapter;
  await remote.put("chunks/a", new Uint8Array([1]));
  const reader = readableStorageFor("chat");
  expect(await reader.get("chunks/a")).toEqual(new Uint8Array([1]));
  await remote.put("chunks/a", new Uint8Array([2]));
  expect(await reader.get("chunks/a")).toEqual(new Uint8Array([2]));
});
