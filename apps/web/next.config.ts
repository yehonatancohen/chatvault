import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // core and storage are shipped as TypeScript source, not prebuilt bundles.
  transpilePackages: ["@chatvault/core", "@chatvault/storage"],
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
