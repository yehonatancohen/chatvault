/** A session generation invalidates readers, tokens and in-flight work on account changes. */
import { useSyncExternalStore } from "react";

let email: string | null | undefined;
let generation = 0;
const listeners = new Set<() => void>();
export function accountEmail(): string | null | undefined { return email; }
export function sessionGeneration(): number { return generation; }
export function subscribeDriveSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setDriveAccount(next: string | null): void {
  if (email === next) return;
  email = next;
  generation += 1;
  for (const listener of listeners) listener();
}
export function assertDriveSession(expected: number): void {
  if (expected !== generation || !email) throw new Error("Google Drive account changed. Reconnect and try again.");
}
export function useDriveSession(): number {
  return useSyncExternalStore(subscribeDriveSession, sessionGeneration, sessionGeneration);
}
