import { FORMAT_VERSION } from "@chatvault/core";

/**
 * Liveness plus the archive format version this deployment understands.
 *
 * The version matters to clients: an app holding an archive written by a newer client needs to
 * know it should prompt for an update rather than render a partial chat.
 */
export function GET(): Response {
  return Response.json(
    { status: "ok", formatVersion: FORMAT_VERSION },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
