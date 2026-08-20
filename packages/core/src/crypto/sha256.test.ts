import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { sha256Hex } from "./sha256.js";

/**
 * Checked against Node's native implementation rather than hand-copied vectors, so the
 * comparison covers arbitrary inputs including the block-boundary cases that trip up
 * hand-rolled padding.
 */
const nodeSha = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");

describe("sha256Hex", () => {
  it("matches the known-answer vectors", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("agrees with node:crypto around every block boundary", () => {
    // 55/56/63/64/65 are where length-field padding either just fits or forces an extra block.
    for (const len of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 1000]) {
      const input = "a".repeat(len);
      expect(sha256Hex(input), `length ${len}`).toBe(nodeSha(input));
    }
  });

  it("agrees with node:crypto on multi-byte UTF-8", () => {
    for (const input of ["שלום עולם", "مرحبا", "😀 emoji 👨‍👩‍👧‍👦 zwj", "naïve café"]) {
      expect(sha256Hex(input), input).toBe(nodeSha(input));
    }
  });
});
