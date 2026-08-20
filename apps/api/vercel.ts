import { type VercelConfig } from "@vercel/config/v1";

/**
 * v1 is deliberately almost empty. The product's trust model means this service must never
 * become the place archives live — see the root CLAUDE.md, invariant 2.
 */
export const config: VercelConfig = {
  functions: {
    "api/**/*.ts": { runtime: "nodejs24.x" },
  },
};
