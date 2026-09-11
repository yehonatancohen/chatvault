import { FOLDER_MIME, type DriveFetch, type DriveRequestInit, type DriveResponse } from "./client.js";

/**
 * An in-memory Google Drive, speaking the slice of the v3 REST API the adapter uses.
 *
 * It exists so the storage contract can run against `GoogleDriveStorageAdapter` in CI
 * (`packages/storage/CLAUDE.md`: every adapter runs the contract, cloud adapters against a fake
 * first). It is deliberately **strict where real Drive is strict** — a malformed `q`, a
 * resumable chunk that is not a multiple of 256 KiB, a `Content-Range` that skips or overlaps
 * bytes, a missing bearer token — so that a bug in the adapter fails here rather than on a
 * user's phone.
 *
 * What it cannot tell you: real quotas, real latency, eventual consistency, token expiry on
 * Google's schedule. That is what the manual run against a throwaway account is for.
 *
 * Test-only. Not exported from `src/index.ts`.
 */

interface StoredFile {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  trashed: boolean;
  createdTime: number;
  modifiedTime: number;
  appProperties: Record<string, string>;
  content: Uint8Array;
}

interface Session {
  /** Update an existing file, or create one with this metadata. */
  fileId?: string;
  metadata?: { name: string; parents: string[] };
  received: Uint8Array[];
  receivedBytes: number;
}

const GRANULE = 256 * 1024;

export class FakeDrive {
  readonly files = new Map<string, StoredFile>();
  /** Every request, for asserting what went over the wire. */
  readonly log: { method: string; url: string }[] = [];

  /** The token requests must carry. Change it to simulate expiry. */
  validToken = "token-1";
  /** Largest page `files.list` returns, regardless of `pageSize` — small, to exercise paging. */
  maxPageSize = 3;

  private nextId = 1;
  private clock = 1;
  private readonly sessions = new Map<string, Session>();
  private readonly faults: ((url: string, init: DriveRequestInit) => DriveResponse | "drop" | undefined)[] = [];

  readonly fetch: DriveFetch = (url, init) => Promise.resolve().then(() => this.handle(url, init));

  /**
   * Inject one fault: the next request `matches` accepts gets `response` instead of being served
   * (`"drop"` = a network failure after the request reached the server, the nastiest kind).
   */
  failNext(
    matches: (url: string, init: DriveRequestInit) => boolean,
    response: { status: number; body?: unknown } | "drop",
  ): void {
    const fault = (url: string, init: DriveRequestInit): DriveResponse | "drop" | undefined => {
      if (!matches(url, init)) return undefined;
      this.faults.splice(this.faults.indexOf(fault), 1);
      return response === "drop" ? "drop" : json(response.status, response.body ?? {});
    };
    this.faults.push(fault);
  }

  /** Paths of every live (untrashed) file under a folder, for assertions. */
  tree(folderId: string, prefix = ""): string[] {
    const out: string[] = [];
    for (const file of this.files.values()) {
      if (file.trashed || !file.parents.includes(folderId)) continue;
      const path = prefix + file.name;
      if (file.mimeType === FOLDER_MIME) out.push(...this.tree(file.id, `${path}/`));
      else out.push(path);
    }
    return out.sort();
  }

  /** Make a folder directly, as test setup. */
  createFolder(name: string, parentId?: string): string {
    return this.insert({ name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : [] }).id;
  }

  // ── request handling ─────────────────────────────────────────────────────────────────────

  private handle(url: string, init: DriveRequestInit): DriveResponse {
    this.log.push({ method: init.method, url });

    for (const fault of [...this.faults]) {
      const injected = fault(url, init);
      if (injected === "drop") {
        // The server saw the request; the client never hears back.
        this.serve(url, init);
        throw new TypeError("Network request failed");
      }
      if (injected !== undefined) return injected;
    }

    if (init.headers.Authorization !== `Bearer ${this.validToken}`) {
      return json(401, { error: { status: "UNAUTHENTICATED" } });
    }
    return this.serve(url, init);
  }

  private serve(url: string, init: DriveRequestInit): DriveResponse {
    const { path, params } = parseUrl(url);

    if (path.startsWith("/session/")) return this.resumableChunk(path, init);

    if (path === "/drive/v3/files" && init.method === "GET") return this.list(params);
    if (path === "/drive/v3/files" && init.method === "POST") {
      const meta = JSON.parse(bodyText(init)) as MetadataBody;
      return json(200, this.describe(this.insert(fromMetadata(meta))));
    }

    const fileMatch = /^\/drive\/v3\/files\/([^/]+)$/.exec(path);
    if (fileMatch) {
      const file = this.files.get(fileMatch[1]!);
      if (file === undefined) return notFound();
      if (init.method === "GET" && params.alt === "media") return this.download(file, init);
      if (init.method === "GET") return json(200, this.describe(file));
      if (init.method === "PATCH") {
        const patch = JSON.parse(bodyText(init)) as { trashed?: boolean };
        if (patch.trashed !== undefined) file.trashed = patch.trashed;
        file.modifiedTime = this.tick();
        return json(200, this.describe(file));
      }
      if (init.method === "DELETE") {
        this.files.delete(file.id);
        return json(204, {});
      }
    }

    if (path === "/upload/drive/v3/files" && init.method === "POST") {
      if (params.uploadType === "multipart") return this.multipartCreate(init);
      if (params.uploadType === "resumable") {
        const meta = JSON.parse(bodyText(init)) as MetadataBody;
        return this.openSession({ metadata: { name: meta.name, parents: meta.parents ?? [] } });
      }
    }

    const uploadMatch = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(path);
    if (uploadMatch && init.method === "PATCH") {
      const file = this.files.get(uploadMatch[1]!);
      if (file === undefined || file.trashed) return notFound();
      if (params.uploadType === "media") {
        file.content = bodyBytes(init).slice();
        file.modifiedTime = this.tick();
        return json(200, { id: file.id });
      }
      if (params.uploadType === "resumable") return this.openSession({ fileId: file.id });
    }

    return json(400, { error: { status: "INVALID_ARGUMENT", message: `fake: ${init.method} ${path}` } });
  }

  private list(params: Record<string, string>): DriveResponse {
    let predicate: (file: StoredFile) => boolean;
    try {
      predicate = compileQuery(params.q ?? "");
    } catch (error) {
      return json(400, { error: { status: "INVALID_ARGUMENT", message: String(error) } });
    }

    const matched = [...this.files.values()].filter(predicate);
    const order = params.orderBy ?? "";
    if (order === "modifiedTime desc") matched.sort((a, b) => b.modifiedTime - a.modifiedTime);
    else if (order === "createdTime") matched.sort((a, b) => a.createdTime - b.createdTime);
    else if (order !== "") return json(400, { error: { status: "INVALID_ARGUMENT", message: `orderBy ${order}` } });

    const start = Number(params.pageToken ?? "0");
    const size = Math.min(Number(params.pageSize ?? "100"), this.maxPageSize);
    const page = matched.slice(start, start + size);
    return json(200, {
      files: page.map((file) => this.describe(file)),
      ...(start + size < matched.length ? { nextPageToken: String(start + size) } : {}),
    });
  }

  private download(file: StoredFile, init: DriveRequestInit): DriveResponse {
    const range = init.headers.Range;
    if (range === undefined) return bytes(200, file.content);
    const match = /^bytes=(\d+)-(\d+)$/.exec(range);
    if (!match) return json(400, { error: { status: "INVALID_ARGUMENT" } });
    const start = Number(match[1]);
    const end = Math.min(Number(match[2]), file.content.byteLength - 1);
    if (start >= file.content.byteLength) return json(416, {});
    return bytes(206, file.content.slice(start, end + 1));
  }

  private multipartCreate(init: DriveRequestInit): DriveResponse {
    const type = init.headers["Content-Type"] ?? "";
    const boundary = /boundary=(\S+)/.exec(type)?.[1];
    if (boundary === undefined) return json(400, { error: { status: "INVALID_ARGUMENT" } });

    const body = bodyBytes(init);
    const parts = splitMultipart(body, boundary);
    if (parts.length !== 2) return json(400, { error: { status: "INVALID_ARGUMENT", message: "parts" } });
    const meta = JSON.parse(latin1(parts[0]!)) as MetadataBody;
    const file = this.insert({ ...fromMetadata(meta), content: parts[1]! });
    return json(200, { id: file.id });
  }

  private openSession(session: Omit<Session, "received" | "receivedBytes">): DriveResponse {
    const id = `s${this.nextId++}`;
    this.sessions.set(id, { ...session, received: [], receivedBytes: 0 });
    return { ...json(200, {}), headers: headers({ Location: `https://fake.upload/session/${id}` }) };
  }

  private resumableChunk(path: string, init: DriveRequestInit): DriveResponse {
    const session = this.sessions.get(path.slice("/session/".length));
    if (session === undefined) return notFound();

    const range = init.headers["Content-Range"] ?? "";
    const body = init.body === undefined ? new Uint8Array(0) : bodyBytes(init);

    const status = /^bytes \*\/(\d+|\*)$/.exec(range);
    const chunk = /^bytes (\d+)-(\d+)\/(\d+|\*)$/.exec(range);
    let total: number | undefined;

    if (status) {
      if (body.byteLength !== 0) return json(400, { error: { message: "status query with a body" } });
      if (status[1] === "*") return this.incomplete(session);
      total = Number(status[1]);
    } else if (chunk) {
      const start = Number(chunk[1]);
      const end = Number(chunk[2]);
      if (start !== session.receivedBytes) {
        return json(400, { error: { message: `chunk starts at ${start}, server has ${session.receivedBytes}` } });
      }
      if (end - start + 1 !== body.byteLength) return json(400, { error: { message: "range/body mismatch" } });
      total = chunk[3] === "*" ? undefined : Number(chunk[3]);
      if (total === undefined && body.byteLength % GRANULE !== 0) {
        return json(400, { error: { message: "non-final chunk must be a multiple of 256 KiB" } });
      }
      session.received.push(body.slice());
      session.receivedBytes += body.byteLength;
    } else {
      return json(400, { error: { message: `bad Content-Range: ${range}` } });
    }

    if (total === undefined) return this.incomplete(session);
    if (total !== session.receivedBytes) {
      return json(400, { error: { message: `total ${total}, received ${session.receivedBytes}` } });
    }

    const content = join(session.received);
    let file: StoredFile;
    if (session.fileId !== undefined) {
      file = this.files.get(session.fileId)!;
      file.content = content;
      file.modifiedTime = this.tick();
    } else {
      file = this.insert({ name: session.metadata!.name, parents: session.metadata!.parents, content });
    }
    this.sessions.delete(path.slice("/session/".length));
    return json(200, { id: file.id });
  }

  private incomplete(session: Session): DriveResponse {
    return {
      ...json(308, {}),
      headers: headers(session.receivedBytes > 0 ? { Range: `bytes=0-${session.receivedBytes - 1}` } : {}),
    };
  }

  private insert(fields: Partial<StoredFile> & { name: string }): StoredFile {
    const now = this.tick();
    const file: StoredFile = {
      id: `f${this.nextId++}`,
      mimeType: "application/octet-stream",
      parents: [],
      trashed: false,
      createdTime: now,
      modifiedTime: now,
      appProperties: {},
      content: new Uint8Array(0),
      ...fields,
    };
    this.files.set(file.id, file);
    return file;
  }

  private describe(file: StoredFile) {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: new Date(file.modifiedTime).toISOString(),
      size: String(file.content.byteLength),
      appProperties: file.appProperties,
    };
  }

  private tick(): number {
    this.clock += 1;
    return this.clock;
  }
}

// ── the `q` language, the part of it we use ───────────────────────────────────────────────

type Predicate = (file: StoredFile) => boolean;

/**
 * Parses the conjunctions the adapter generates. Anything else is a 400, as it would be from
 * Drive — an adapter that builds a query this cannot read has built a query Drive may not read.
 */
function compileQuery(q: string): Predicate {
  let i = 0;
  const skipSpace = () => {
    while (q[i] === " ") i += 1;
  };
  const expect = (text: string) => {
    skipSpace();
    if (!q.startsWith(text, i)) throw new Error(`expected "${text}" at ${i} in: ${q}`);
    i += text.length;
  };
  const string = (): string => {
    skipSpace();
    if (q[i] !== "'") throw new Error(`expected a quoted string at ${i} in: ${q}`);
    i += 1;
    let out = "";
    while (i < q.length && q[i] !== "'") {
      if (q[i] === "\\") i += 1;
      out += q[i];
      i += 1;
    }
    if (q[i] !== "'") throw new Error(`unterminated string in: ${q}`);
    i += 1;
    return out;
  };

  const clauses: Predicate[] = [];
  for (;;) {
    skipSpace();
    if (q.startsWith("appProperties has {", i)) {
      i += "appProperties has {".length;
      expect("key=");
      const key = string();
      expect("and value=");
      const value = string();
      expect("}");
      clauses.push((f) => f.appProperties[key] === value);
    } else if (q[i] === "'") {
      const id = string();
      expect("in parents");
      clauses.push((f) => f.parents.includes(id));
    } else if (q.startsWith("trashed = false", i)) {
      i += "trashed = false".length;
      clauses.push((f) => !f.trashed);
    } else {
      const field = /^(name|mimeType) (=|!=) /.exec(q.slice(i));
      if (!field) throw new Error(`unsupported clause at ${i} in: ${q}`);
      i += field[0].length;
      const value = string();
      const key = field[1] as "name" | "mimeType";
      clauses.push(field[2] === "=" ? (f) => f[key] === value : (f) => f[key] !== value);
    }
    skipSpace();
    if (i >= q.length) break;
    expect("and");
  }
  return (file) => clauses.every((clause) => clause(file));
}

// ── helpers ─────────────────────────────────────────────────────────────────────────────────

interface MetadataBody {
  name: string;
  mimeType?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
}

function fromMetadata(meta: MetadataBody): Partial<StoredFile> & { name: string } {
  return {
    name: meta.name,
    ...(meta.mimeType !== undefined ? { mimeType: meta.mimeType } : {}),
    parents: meta.parents ?? [],
    appProperties: { ...(meta.appProperties ?? {}) },
  };
}

function parseUrl(url: string): { path: string; params: Record<string, string> } {
  const match = /^https:\/\/[^/]+(\/[^?]*)(?:\?(.*))?$/.exec(url);
  if (!match) throw new Error(`fake: unparseable URL ${url}`);
  const params: Record<string, string> = {};
  for (const pair of (match[2] ?? "").split("&")) {
    if (pair === "") continue;
    const eq = pair.indexOf("=");
    params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
  }
  return { path: match[1]!, params };
}

function bodyBytes(init: DriveRequestInit): Uint8Array {
  if (init.body === undefined) return new Uint8Array(0);
  if (typeof init.body === "string") return Uint8Array.from(init.body, (c) => c.charCodeAt(0));
  return init.body;
}

function bodyText(init: DriveRequestInit): string {
  return typeof init.body === "string" ? init.body : latin1(bodyBytes(init));
}

function latin1(data: Uint8Array): string {
  let out = "";
  for (const b of data) out += String.fromCharCode(b);
  return out;
}

function splitMultipart(body: Uint8Array, boundary: string): Uint8Array[] {
  const text = latin1(body);
  const delimiter = `--${boundary}`;
  const segments = text.split(delimiter);
  // ["", part1, part2, "--"] for a well-formed body.
  if (segments[0] !== "" || segments[segments.length - 1] !== "--") return [];
  return segments.slice(1, -1).map((segment) => {
    const headerEnd = segment.indexOf("\r\n\r\n");
    if (!segment.startsWith("\r\n") || headerEnd === -1 || !segment.endsWith("\r\n")) {
      throw new Error("fake: malformed multipart part");
    }
    const content = segment.slice(headerEnd + 4, segment.length - 2);
    return Uint8Array.from(content, (c) => c.charCodeAt(0));
  });
}

function join(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function headers(values: Record<string, string>): DriveResponse["headers"] {
  const lower = Object.fromEntries(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name) => lower[name.toLowerCase()] ?? null };
}

function json(status: number, body: unknown): DriveResponse {
  const text = JSON.stringify(body);
  return {
    status,
    headers: headers({ "Content-Type": "application/json" }),
    text: () => Promise.resolve(text),
    arrayBuffer: () => Promise.resolve(Uint8Array.from(text, (c) => c.charCodeAt(0)).buffer),
  };
}

function bytes(status: number, data: Uint8Array): DriveResponse {
  const copy = data.slice();
  return {
    status,
    headers: headers({ "Content-Type": "application/octet-stream" }),
    text: () => Promise.resolve(latin1(copy)),
    arrayBuffer: () => Promise.resolve(copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength)),
  };
}

function notFound(): DriveResponse {
  return json(404, { error: { status: "NOT_FOUND", errors: [{ reason: "notFound" }] } });
}
