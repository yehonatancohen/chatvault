// Learn more: https://docs.expo.dev/guides/monorepo/
// `expo/metro-config`'s getDefaultConfig already detects the pnpm workspace root and sets
// watchFolders / nodeModulesPaths accordingly — do not re-set them here.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// `@chatvault/core` and `@chatvault/storage` ship as TypeScript source, not prebuilt
// bundles. Their internal imports use NodeNext-style explicit `.js` extensions (e.g.
// `./parser/parse.js`) on files that are actually `.ts` — that is what lets `core` run
// unmodified under Node's ESM loader (root CLAUDE.md invariant 3). Metro does not do that
// resolution on its own, so a relative `.js` specifier *from inside those two packages* is
// retried as `.ts` / `.tsx`. Scoped to their source dirs so it can never affect app code or
// node_modules, where `./foo.js` really does mean a `.js` file.
// This is the Metro counterpart of `apps/web/next.config.ts`'s `resolve.extensionAlias`.
const tsSourceRoots = [
  path.join(workspaceRoot, "packages", "core", "src") + path.sep,
  path.join(workspaceRoot, "packages", "storage", "src") + path.sep,
];
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = context.originModulePath || "";
  const fromTsSource = tsSourceRoots.some((root) => origin.startsWith(root));
  if (
    fromTsSource &&
    moduleName.endsWith(".js") &&
    (moduleName.startsWith("./") || moduleName.startsWith("../"))
  ) {
    for (const ext of [".ts", ".tsx"]) {
      try {
        return context.resolveRequest(
          context,
          moduleName.slice(0, -3) + ext,
          platform,
        );
      } catch {
        // not a TS source file under that name — try the next extension, then fall through
      }
    }
  }
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  return resolve(context, moduleName, platform);
};

module.exports = config;
