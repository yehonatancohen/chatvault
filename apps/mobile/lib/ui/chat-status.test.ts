import { describe, expect, it } from "vitest";
import { chatStatus, progressFraction } from "./chat-status";

describe("chatStatus", () => {
  it("is on the phone until Drive has it", () => {
    expect(chatStatus({ updatedAt: 100 })).toEqual({ kind: "device" });
  });

  it("shows upload progress while a backup runs", () => {
    expect(chatStatus({ updatedAt: 100, uploading: { fraction: 0.25 } })).toEqual({
      kind: "uploading",
      fraction: 0.25,
    });
  });

  it("is safe to delete once the latest version is in Drive", () => {
    expect(chatStatus({ updatedAt: 100, backedUpAt: 150 })).toEqual({ kind: "safe" });
  });

  it("goes back to 'on this phone' when an import lands after the last backup", () => {
    // The Drive copy is missing the newest messages, so deleting the chat now would lose them.
    expect(chatStatus({ updatedAt: 200, backedUpAt: 150 })).toEqual({ kind: "device" });
  });

  it("is 'deleted' only when the user said so and Drive has it", () => {
    expect(chatStatus({ updatedAt: 100, backedUpAt: 150, deletedAt: 160 })).toEqual({ kind: "deleted" });
    // Deleted in WhatsApp but never backed up: the phone copy is the only one, and says so.
    expect(chatStatus({ updatedAt: 100, deletedAt: 160 })).toEqual({ kind: "device" });
  });
});

describe("progressFraction", () => {
  it("follows bytes, not files: one big video dominates", () => {
    // 9 of 10 files done, but the one left is most of the bytes.
    expect(progressFraction({ done: 9, total: 10, bytesDone: 10, bytesTotal: 1000 })).toBe(0.01);
  });

  it("counts files when nothing is being uploaded", () => {
    expect(progressFraction({ done: 3, total: 12, bytesTotal: 0 })).toBe(0.25);
    expect(progressFraction(undefined)).toBe(0);
  });
});
