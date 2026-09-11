/**
 * The small slice of the Google Drive v3 REST API that Boydem uses, over an injected `fetch`.
 *
 * Injected rather than global because each runtime has a different good answer: the mobile app
 * passes `expo/fetch` (React Native's built-in fetch cannot hand back binary reliably), the web
 * viewer passes the browser's, and tests pass `FakeDrive` — an in-memory Drive that the
 * conformance suite runs against. Nothing here may touch `node:*` or a DOM global; like
 * `contract.ts`, this runs under Hermes.
 *
 * **What this client never does: send chat content anywhere but the user's own Drive.** Every
 * URL below is `googleapis.com`, every byte it uploads is ciphertext handed down by `core`, and
 * the access token belongs to the user. Boydem's own servers are not in this path at all (root
 * `CLAUDE.md`, invariant 2).
 */

export const DRIVE_API = "https://www.googleapis.com/drive/v3";
export const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
export const FOLDER_MIME = "application/vnd.google-apps.folder";

/**
 * The only scope Boydem asks for: files this app created, and nothing else in the user's Drive.
 * Broader scopes (`drive`, `drive.readonly`) are "restricted" and put the app through Google's
 * paid annual security assessment — and would let us see files we have no business seeing.
 */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/** Just enough of `RequestInit` to describe what this client sends. */
export interface DriveRequestInit {
  readonly method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: Uint8Array | string;
}

/** Just enough of `Response` for this client — satisfied by every real `fetch` and by `FakeDrive`. */
export interface DriveResponse {
  readonly status: number;
  readonly headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

export type DriveFetch = (url: string, init: DriveRequestInit) => Promise<DriveResponse>;

export interface DriveFile {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly modifiedTime?: string;
  readonly size?: string;
  readonly appProperties?: Readonly<Record<string, string>>;
}

export interface DriveClientOptions {
  readonly fetch: DriveFetch;
  /**
   * A current OAuth access token carrying `DRIVE_SCOPE`. Called before every request, so it
   * should return a cached token cheaply; called with `forceRefresh: true` after a 401, when the
   * cached one has expired or been revoked.
   */
  readonly getAccessToken: (options: { readonly forceRefresh: boolean }) => Promise<string>;
  /** Attempts per request for rate limits, 5xx and network failures. Default 5. */
  readonly maxAttempts?: number;
  /** First backoff delay; doubles per attempt, with jitter. Default 500 ms. */
  readonly baseDelayMs?: number;
  /** Injected so tests do not actually wait. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/** A Drive call that failed for a reason retrying will not fix. */
export class DriveError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "DriveError";
  }
}

/** The user revoked access, or the token cannot be refreshed. The UI's cue to reconnect Drive. */
export class DriveAuthError extends DriveError {
  constructor(message: string) {
    super(401, "authError", message);
    this.name = "DriveAuthError";
  }
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
/** Drive reports rate limiting as a 403 with one of these reasons, not as a 429. */
const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);

/** Escape a value for a single-quoted string in a Drive `q` query. */
export function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

export class DriveClient {
  private readonly fetchImpl: DriveFetch;
  private readonly getAccessToken: DriveClientOptions["getAccessToken"];
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: DriveClientOptions) {
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.baseDelayMs = options.baseDelayMs ?? 500;
    this.sleep = options.sleep ?? defaultSleep;
  }

  /**
   * One HTTP call with auth and retries. Returns the response for any status in `accept`;
   * anything else becomes a `DriveError`.
   *
   * A 401 is retried once with a forced token refresh, then reported as `DriveAuthError`.
   * Rate limits, 5xx and network failures back off and retry. Note that a retried *create* can
   * in rare cases leave a duplicate file behind (the first attempt succeeded, its response was
   * lost); the adapter tolerates duplicates by always reading the newest.
   */
  async request(
    url: string,
    init: DriveRequestInit,
    accept: readonly number[] = [200],
    options: { readonly attempts?: number } = {},
  ): Promise<DriveResponse> {
    const maxAttempts = options.attempts ?? this.maxAttempts;
    let refreshed = false;

    for (let attempt = 1; ; attempt += 1) {
      const token = await this.getAccessToken({ forceRefresh: refreshed });
      let response: DriveResponse;
      try {
        response = await this.fetchImpl(url, {
          ...init,
          headers: { ...init.headers, Authorization: `Bearer ${token}` },
        });
      } catch (error) {
        if (attempt >= maxAttempts) throw error;
        await this.backoff(attempt);
        continue;
      }

      if (accept.includes(response.status)) return response;

      if (response.status === 401) {
        if (refreshed) {
          throw new DriveAuthError("Google Drive rejected the access token after a refresh");
        }
        refreshed = true;
        attempt -= 1; // a token refresh is not a failed attempt
        continue;
      }

      const reason = await errorReason(response);
      const retryable =
        RETRYABLE_STATUS.has(response.status) ||
        (response.status === 403 && reason !== undefined && RATE_LIMIT_REASONS.has(reason));
      if (retryable && attempt < maxAttempts) {
        await this.backoff(attempt);
        continue;
      }

      throw new DriveError(
        response.status,
        reason,
        `Google Drive ${init.method} ${redact(url)} failed: ${response.status}${reason ? ` (${reason})` : ""}`,
      );
    }
  }

  async json<T>(url: string, init: DriveRequestInit, accept?: readonly number[]): Promise<T> {
    const response = await this.request(url, init, accept);
    return JSON.parse(await response.text()) as T;
  }

  /** Every file matching `q`, across pages. Trashed files are the caller's to exclude in `q`. */
  async listFiles(q: string, orderBy?: string): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const params = new URLSearchParamsLite({
        q,
        pageSize: "1000",
        fields: "nextPageToken,files(id,name,mimeType,modifiedTime,size,appProperties)",
        spaces: "drive",
        ...(orderBy !== undefined ? { orderBy } : {}),
        ...(pageToken !== undefined ? { pageToken } : {}),
      });
      const page = await this.json<{ nextPageToken?: string; files?: DriveFile[] }>(
        `${DRIVE_API}/files?${params.toString()}`,
        { method: "GET", headers: {} },
      );
      files.push(...(page.files ?? []));
      pageToken = page.nextPageToken;
    } while (pageToken !== undefined);
    return files;
  }

  async createFolder(
    name: string,
    parentId: string | undefined,
    appProperties?: Readonly<Record<string, string>>,
  ): Promise<DriveFile> {
    return this.json<DriveFile>(
      `${DRIVE_API}/files?fields=id,name,mimeType,appProperties`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: asciiJson({
          name,
          mimeType: FOLDER_MIME,
          ...(parentId !== undefined ? { parents: [parentId] } : {}),
          ...(appProperties !== undefined ? { appProperties } : {}),
        }),
      },
    );
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = this.baseDelayMs * 2 ** (attempt - 1);
    await this.sleep(delay / 2 + Math.random() * (delay / 2));
  }
}

/**
 * `JSON.stringify`, with every non-ASCII character escaped as `\uXXXX`.
 *
 * So a request body is plain ASCII and can be turned into bytes without `TextEncoder`, which not
 * every runtime this must run in provides — the same constraint `contract.ts` works under. The
 * JSON means exactly the same thing either way.
 */
export function asciiJson(value: unknown): string {
  return JSON.stringify(value).replace(
    /[-￿]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

/** ASCII text to bytes. Callers guarantee ASCII — see `asciiJson`. */
export function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i) & 0x7f;
  return out;
}

/**
 * Query-string building without `URLSearchParams`, which Hermes has only partially — and which
 * is exactly the kind of gap that passes every Node test and then fails on a phone.
 */
class URLSearchParamsLite {
  constructor(private readonly params: Readonly<Record<string, string>>) {}
  toString(): string {
    return Object.entries(this.params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
  }
}

export function queryString(params: Readonly<Record<string, string>>): string {
  return new URLSearchParamsLite(params).toString();
}

async function errorReason(response: DriveResponse): Promise<string | undefined> {
  try {
    const body = JSON.parse(await response.text()) as {
      error?: { errors?: { reason?: string }[]; status?: string };
    };
    return body.error?.errors?.[0]?.reason ?? body.error?.status;
  } catch {
    return undefined;
  }
}

/** Drop the query string from a URL before it goes into an error message or a log. */
function redact(url: string): string {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

function defaultSleep(ms: number): Promise<void> {
  const timers = globalThis as unknown as { setTimeout(callback: () => void, ms: number): unknown };
  return new Promise((resolve) => {
    timers.setTimeout(resolve, ms);
  });
}
