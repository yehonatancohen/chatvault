import { describe, expect, it } from "vitest";
import { toBase64Url } from "./base64";

describe("toBase64Url", () => {
  it("matches Node's base64url for every length, including a 32-byte key", () => {
    for (let length = 0; length <= 40; length += 1) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 97 + length * 13) & 0xff);
      expect(toBase64Url(bytes)).toBe(Buffer.from(bytes).toString("base64url"));
    }
  });
});
