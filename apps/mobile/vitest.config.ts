import { defineConfig } from "vitest/config";

/**
 * Only `lib/`, deliberately. Screens and native-module code (anything importing
 * `expo-file-system`, `expo-router`, etc.) cannot run under Node — see
 * `lib/storage/expo-file-system-adapter.ts`'s doc comment. This config exists for the pure-JS
 * pieces, like the zip reader, that genuinely can be tested here.
 */
export default defineConfig({
  test: { globals: true, environment: "node", include: ["lib/**/*.test.ts"] },
});
