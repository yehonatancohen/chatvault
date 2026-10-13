import path from "node:path";
import type { NextConfig } from "next";

/**
 * Sent with every page. None of these is a content-security policy — the viewer's own rule
 * ("no third-party script on `/s/` pages", `CLAUDE.md`) is kept by not importing any — but they
 * close the cheap doors: the site cannot be framed by another origin, a response is never
 * sniffed into a different type, and the browser features this site never uses stay off.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  // A separate output folder when asked for one, so a verification build (NEXT_DIST_DIR=.next-verify
  // pnpm build) can run while `next dev` is serving — sharing `.next` makes the dev server fail
  // with ENOENT on vendor chunks the build just replaced.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // core and storage are shipped as TypeScript source, not prebuilt bundles.
  transpilePackages: ["@chatvault/core", "@chatvault/storage"],
  // The workspace root, said out loud: left to infer it, Next picks whichever lockfile it finds
  // highest up the disk, which on a developer's machine may not be this repo's at all.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // core's internal imports use NodeNext-style explicit `.js` extensions (e.g.
  // `./parser/parse.js`) even though the files on disk are `.ts` — that is what lets it run
  // unmodified under Node's ESM loader. Webpack does not do that resolution on its own, so it
  // needs to be told a `.js` specifier may resolve to a `.ts` file here.
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
