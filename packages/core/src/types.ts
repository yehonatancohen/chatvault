/**
 * Shared domain types. Kept free of platform concerns on purpose — see root CLAUDE.md
 * invariant 3: this package must run identically in Node, Hermes and the browser.
 */

/**
 * What a line turned out to be. The distinction matters for merge: `system` messages are
 * per-participant (each member sees a different set) and must never be treated as evidence
 * that another member's copy is missing something.
 */
export type MessageKind =
  | "text"
  | "attachment"
  | "omitted-media"
  | "deleted"
  | "system";

export interface Attachment {
  /** Filename exactly as WhatsApp wrote it, e.g. `IMG-20240315-WA0001.jpg`. */
  readonly filename: string;
  /** Content hash, filled in once the blob is read out of the export zip. */
  readonly sha256?: string;
}

export interface ParsedMessage {
  /** Deterministic content-derived identity. See `identity.ts`. */
  readonly id: string;
  /** Epoch ms, resolved using the source's assumed UTC offset. */
  readonly ts: number;
  /** Wall-clock the export literally printed, `YYYY-MM-DDTHH:mm:ss`, no zone. */
  readonly wallClock: string;
  /** Display name as written by the exporter. `null` for system messages. */
  readonly sender: string | null;
  readonly body: string;
  readonly kind: MessageKind;
  readonly attachment?: Attachment;
}

/** Which component of a `a/b/c` date is the day. Inferred per file, never assumed. */
export type DateOrder = "DMY" | "MDY" | "YMD";

export interface ExportDialect {
  readonly dateOrder: DateOrder;
  /** iOS wraps headers in brackets; Android uses ` - ` as the separator. */
  readonly platform: "ios" | "android" | "unknown";
  readonly hasSeconds: boolean;
  readonly clock: "12h" | "24h";
}

/**
 * A single import event: one file a user shared in. Kept in the manifest so a merged archive
 * can explain where any given message came from.
 */
export interface ImportSource {
  readonly id: string;
  /** Display name of whoever produced this export, if known. */
  readonly contributor: string | null;
  /**
   * Minutes east of UTC that this export's wall-clock times are assumed to be in.
   * Exports carry no timezone, so this is an assumption, not a fact. Two members in
   * different zones will produce different wall-clocks for the same message; setting this
   * correctly is what lets those still merge. Defaults to 0 (treat all sources alike).
   */
  readonly tzOffsetMinutes: number;
  readonly importedAt: number;
  readonly dialect: ExportDialect;
}

/** A problem with one line. Parsing never aborts — see root CLAUDE.md, error conventions. */
export interface ParseIssue {
  readonly line: number;
  readonly reason:
    | "unparsable-header"
    | "orphan-continuation"
    | "bad-datetime"
    | "empty";
  readonly raw: string;
}

export interface ParseResult {
  readonly messages: readonly ParsedMessage[];
  readonly issues: readonly ParseIssue[];
  readonly dialect: ExportDialect;
  /** Distinct sender display names seen, in first-appearance order. */
  readonly participants: readonly string[];
}
