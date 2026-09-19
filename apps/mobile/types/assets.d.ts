/**
 * Local image imports. Metro resolves these to a numeric asset id at bundle time; nothing in
 * this workspace had imported a static image before the login screen and the tutorial's first
 * slide, so TypeScript had nothing declaring the module shape. The tutorial's screenshots and the
 * display font come in the same way.
 */
declare module "*.png" {
  const value: number;
  export default value;
}

/** Font files, loaded by `useFonts` in `app/_layout.tsx`; Metro resolves them the same way. */
declare module "*.ttf" {
  const value: number;
  export default value;
}
