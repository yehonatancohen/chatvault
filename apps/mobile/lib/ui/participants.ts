/**
 * Naming the people in a chat without filling the screen with them.
 *
 * A 1:1 chat has two participants and a family group has sixty. The Verify screen printed all
 * of them joined by commas, which turned the most important screen in the app into something
 * you had to scroll past to reach the numbers you came for.
 *
 * So: name a few, count the rest, and let the reader expand if they care. Kept pure and tested
 * because the plural and comma rules are exactly the sort of thing that reads as sloppiness
 * when it goes wrong ("Dana, and 1 others").
 */

import type { Language } from "../settings/settings";

export interface ParticipantSummary {
  /** The names actually rendered. */
  readonly shown: readonly string[];
  readonly hiddenCount: number;
  /** One line, ready to display: `Dana, Yonatan and 12 others`. */
  readonly label: string;
  /** Whether an expand control is worth showing at all. */
  readonly collapsible: boolean;
}

export const DEFAULT_VISIBLE_PARTICIPANTS = 3;

/**
 * Language defaults to English so `participants.test.ts` needs no knowledge of the setting.
 *
 * Hebrew joins with the prefix ו־ attached to the last name rather than a separate word, which
 * is why the conjunction cannot simply be a translated string dropped between two names.
 */
export function summarizeParticipants(
  names: readonly string[],
  visible: number = DEFAULT_VISIBLE_PARTICIPANTS,
  language: Language = "en",
): ParticipantSummary {
  if (names.length === 0) {
    return {
      shown: [],
      hiddenCount: 0,
      label: language === "he" ? "אף אחד" : "No one",
      collapsible: false,
    };
  }

  // Showing "and 1 other" while hiding exactly one name is worse than just showing the name.
  const limit = names.length === visible + 1 ? names.length : visible;
  const shown = names.slice(0, limit);
  const hiddenCount = names.length - shown.length;

  const label =
    hiddenCount === 0
      ? joinNames(shown, language)
      : language === "he"
        ? `${shown.join(", ")} ועוד ${hiddenCount}`
        : `${shown.join(", ")} and ${hiddenCount} others`;

  return { shown, hiddenCount, label, collapsible: hiddenCount > 0 };
}

/** `a`, `a and b`, `a, b and c` — the Oxford comma is deliberately absent; this is a list of people. */
function joinNames(names: readonly string[], language: Language): string {
  if (names.length === 1) return names[0]!;
  const last = names[names.length - 1]!;
  const rest = names.slice(0, -1).join(", ");
  return language === "he" ? `${rest} ו${last}` : `${rest} and ${last}`;
}

/**
 * A stable colour per participant, so a name keeps its colour down the whole conversation.
 *
 * Hue only, from a hash of the name: every colour comes out at the same saturation and
 * lightness, so no participant is louder than another and all of them stay readable on the
 * chat background. Deterministic, so it survives reopening the archive.
 */
export function colorForParticipant(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360}, 45%, 38%)`;
}
