import type { MergedMessage } from "../merge.js";
import type { Attachment, MessageKind } from "../types.js";

/**
 * Chunk payload codec: one JSON object per line, newline-terminated.
 *
 * `encodeChunk` is *canonical* — fields are written in a fixed order and absent optionals are
 * omitted rather than serialized as `null`. That matters beyond tidiness: the writer decides
 * whether an append may reuse an existing chunk by comparing freshly encoded bytes against the
 * decrypted old ones, and any ordering that depended on object construction would make a
 * decoded-then-re-encoded message differ from its own stored form and force a pointless
 * rewrite of every chunk.
 */

const MESSAGE_KINDS: readonly MessageKind[] = [
  "text",
  "attachment",
  "omitted-media",
  "deleted",
  "system",
];

const isMessageKind = (value: unknown): value is MessageKind =>
  typeof value === "string" && (MESSAGE_KINDS as readonly string[]).includes(value);

export class MalformedChunkError extends Error {
  constructor(
    readonly line: number,
    readonly detail: string,
  ) {
    super(`Chunk line ${line} is malformed: ${detail}`);
    this.name = "MalformedChunkError";
  }
}

function encodeAttachment(attachment: Attachment): Record<string, unknown> {
  return {
    filename: attachment.filename,
    ...(attachment.sha256 === undefined ? {} : { sha256: attachment.sha256 }),
  };
}

export function encodeMessage(message: MergedMessage): string {
  return JSON.stringify({
    id: message.id,
    ts: message.ts,
    wallClock: message.wallClock,
    sender: message.sender,
    body: message.body,
    kind: message.kind,
    ...(message.attachment === undefined
      ? {}
      : { attachment: encodeAttachment(message.attachment) }),
    sourceIds: message.sourceIds,
  });
}

export function encodeChunk(messages: readonly MergedMessage[]): string {
  return messages.map(encodeMessage).join("\n") + "\n";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function decodeAttachment(value: unknown, line: number): Attachment {
  if (!isRecord(value) || typeof value["filename"] !== "string") {
    throw new MalformedChunkError(line, "attachment.filename missing");
  }
  const sha256 = value["sha256"];
  if (sha256 !== undefined && typeof sha256 !== "string") {
    throw new MalformedChunkError(line, "attachment.sha256 not a string");
  }
  // Spread rather than assign: `exactOptionalPropertyTypes` forbids writing `undefined` into
  // an optional field, and an absent hash must stay absent so round-tripping is byte-stable.
  return { filename: value["filename"], ...(sha256 === undefined ? {} : { sha256 }) };
}

export function decodeMessage(value: unknown, line: number): MergedMessage {
  if (!isRecord(value)) throw new MalformedChunkError(line, "not an object");

  const { id, ts, wallClock, sender, body, kind, sourceIds } = value;
  if (typeof id !== "string") throw new MalformedChunkError(line, "id");
  if (typeof ts !== "number") throw new MalformedChunkError(line, "ts");
  if (typeof wallClock !== "string") throw new MalformedChunkError(line, "wallClock");
  if (sender !== null && typeof sender !== "string") {
    throw new MalformedChunkError(line, "sender");
  }
  if (typeof body !== "string") throw new MalformedChunkError(line, "body");
  if (!isMessageKind(kind)) throw new MalformedChunkError(line, "kind");
  if (!isStringArray(sourceIds)) throw new MalformedChunkError(line, "sourceIds");

  const attachment = value["attachment"];
  return {
    id,
    ts,
    wallClock,
    sender,
    body,
    kind,
    ...(attachment === undefined
      ? {}
      : { attachment: decodeAttachment(attachment, line) }),
    sourceIds,
  };
}

export function decodeChunk(text: string): MergedMessage[] {
  const messages: MergedMessage[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    // The payload is newline-*terminated*, so the final split yields an empty tail. Blank
    // lines anywhere else are equally harmless to skip; a truncated file shows up as a JSON
    // parse failure, not as a silently short chunk.
    if (line.length === 0) continue;
    messages.push(decodeMessage(JSON.parse(line) as unknown, i + 1));
  }

  return messages;
}
