/**
 * Local image imports. Metro resolves these to a numeric asset id at bundle time; nothing in
 * this workspace had imported a static image before the login screen and the tutorial's first
 * slide, so TypeScript had nothing declaring the module shape.
 */
declare module "*.png" {
  const value: number;
  export default value;
}
