/**
 * Reading the archive key out of the URL fragment.
 *
 * The fragment is the whole reason the web viewer can be zero-knowledge: browsers never send
 * anything after `#` to the server, so a link like
 *
 *     https://chatvault.app/a/<archiveId>#k=<base64url key>
 *
 * carries the decryption key past our infrastructure without it ever touching a request log,
 * an access log, a CDN cache, or a referrer header.
 *
 * Because of that, this module has rules that look paranoid and are not:
 * - Never read the fragment on the server. It is not there, and reaching for it is a sign the
 *   code has drifted into a Server Component.
 * - Never put the key into `history.pushState`, an analytics call, an error report, or a
 *   `fetch` body. Anything that serializes the URL must strip it first.
 */

const KEY_PARAM = "k";

export class MissingKeyError extends Error {
  constructor() {
    super("This link is missing its decryption key. Ask whoever shared it for the full URL.");
    this.name = "MissingKeyError";
  }
}

function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

/**
 * Pull the archive key from `location.hash`. Client-side only — throws rather than returning
 * `null` on the server, because a silent `null` would look like "no key provided" and send the
 * user down a misleading error path.
 */
export function readKeyFromFragment(hash: string): Uint8Array {
  if (typeof window === "undefined") {
    throw new Error("readKeyFromFragment is client-only: the fragment never reaches the server");
  }

  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const encoded = params.get(KEY_PARAM);
  if (!encoded) throw new MissingKeyError();

  const key = base64UrlToBytes(encoded);
  if (key.length !== 32) throw new MissingKeyError();
  return key;
}

/** URL with the key stripped — the only form safe to log, report or navigate to. */
export function withoutKey(url: string): string {
  const [base] = url.split("#");
  return base ?? url;
}
