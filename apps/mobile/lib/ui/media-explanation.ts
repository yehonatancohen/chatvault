/**
 * Explaining media the archive does not contain.
 *
 * "Not all media is saved" is the single most alarming sentence this app says, and it is said
 * at the moment a user is deciding whether to delete the only other copy. Getting it right is
 * not decoration: a user who does not understand *why* will either delete something they
 * wanted, or distrust the whole archive and delete nothing.
 *
 * The two causes look identical in the summary and are completely different in practice:
 *
 * - **WhatsApp omitted it.** The transcript literally says `image omitted`. The file is not on
 *   the phone any more — cleared to save space, never downloaded, or a view-once/disappearing
 *   message. Nothing was lost by us; it was already gone before the export ran. Crucially,
 *   this is *also* what a "without media" export looks like, which is a completely different
 *   situation with a completely different fix.
 * - **The export named a file it did not contain.** The chat references a filename that was
 *   not in the zip. Usually an interrupted or truncated export.
 *
 * The distinction drives the advice, so it is computed here — as data, tested — rather than
 * assembled inline in a screen where nobody can check it.
 *
 * The other thing this must say, and the original copy did not: **the messages themselves are
 * archived either way.** Only the file is missing. A user reading "3 media files will not be
 * saved" reasonably fears they are losing three whole messages, and they are not.
 *
 * **Both languages live here, beside the logic that chooses between them.** The decisions —
 * which severity, which causes, which next steps, in which order — are made exactly once and
 * are language-independent; `COPY` holds only the sentences. Putting these in the general
 * string catalogue was the alternative and was rejected: this is the one place in the app where
 * the wording is *derived from numbers*, and separating the two would put the most consequential
 * copy in the product beyond the reach of the test that checks it.
 */

import type { MediaStats } from "@chatvault/core";
import type { Language } from "../settings/settings";

export type LossSeverity = "none" | "some" | "all";

export interface LossCause {
  readonly count: number;
  /** One line naming what happened, in the user's terms. */
  readonly what: string;
  /** Why it happened. The part that turns alarm into understanding. */
  readonly why: string;
}

export interface MediaExplanation {
  readonly severity: LossSeverity;
  readonly headline: string;
  /** What the archive *does* hold. Always present: the good news is information too. */
  readonly saved: string;
  readonly causes: readonly LossCause[];
  /** The reassurance that the messages survive even when their files do not. */
  readonly stillSaved?: string;
  /** Concrete, ordered, and only ever things that might actually work. */
  readonly nextSteps: readonly string[];
}

interface Copy {
  readonly noMedia: string;
  readonly savedFiles: (n: number) => string;
  readonly noneHeadlineEmpty: string;
  readonly noneHeadline: string;
  readonly omittedWhatTextOnly: (n: number) => string;
  readonly omittedWhat: (n: number) => string;
  readonly omittedWhyTextOnly: string;
  readonly omittedWhy: string;
  readonly missingWhat: (n: number) => string;
  readonly missingWhy: string;
  readonly stepReexportWithMedia: string;
  readonly stepReexportAfterTruncation: string;
  readonly stepScrollBack: string;
  readonly stepAskSomeoneElse: string;
  readonly headlineTextOnly: string;
  readonly headlineSome: (n: number) => string;
  readonly stillSaved: string;
}

const COPY: Record<Language, Copy> = {
  en: {
    noMedia: "No media files are in this archive.",
    savedFiles: (n) => `${count(n)} ${n === 1 ? "file" : "files"} saved and encrypted.`,
    noneHeadlineEmpty: "This chat has no photos or files",
    noneHeadline: "Every photo and file in this chat was saved",
    omittedWhatTextOnly: (n) =>
      `${count(n)} ${n === 1 ? "photo, video or file" : "photos, videos or files"} the export did not include`,
    omittedWhat: (n) => `${count(n)} WhatsApp had already lost`,
    omittedWhyTextOnly:
      "This export was made without media, so WhatsApp wrote a placeholder where each file " +
      "should be. The files are still in WhatsApp — they were simply not part of this export.",
    omittedWhy:
      "WhatsApp wrote “image omitted” for these, meaning the file was no longer on this " +
      "phone when you exported. That usually means it was cleared to save space, was never " +
      "downloaded, or was a view-once or disappearing message. It was already gone before " +
      "this app saw the chat.",
    missingWhat: (n) => `${count(n)} the export named but did not contain`,
    missingWhy:
      "The chat refers to these files by name, but they were not inside the file you shared. " +
      "That normally means the export was cut short — WhatsApp stops adding media once an " +
      "export gets large.",
    stepReexportWithMedia:
      "Export the chat again and choose “Attach Media” this time, then share it here. " +
      "It will be merged into this archive — nothing is duplicated.",
    stepReexportAfterTruncation:
      "Export the chat again with media and share it here. A second export often completes " +
      "the files this one cut short, and merging adds only what is new.",
    stepScrollBack:
      "Open the chat in WhatsApp and scroll to the older photos so they download again, " +
      "then export once more. Anything WhatsApp can still fetch will be included.",
    stepAskSomeoneElse:
      "Ask someone else in this chat to archive their copy. Their phone may still have files " +
      "yours no longer does, and their export merges into this same archive.",
    headlineTextOnly: "This export did not include the media",
    headlineSome: (n) => `${count(n)} ${n === 1 ? "file" : "files"} could not be saved`,
    stillSaved:
      "The messages themselves are safe. Who sent them, when, and any caption written with " +
      "the photo are all in the archive — it is only the file itself that is missing.",
  },
  he: {
    noMedia: "אין קובצי מדיה בארכיון הזה.",
    savedFiles: (n) => (n === 1 ? "קובץ אחד נשמר והוצפן." : `${count(n)} קבצים נשמרו והוצפנו.`),
    noneHeadlineEmpty: "אין בצ׳אט הזה תמונות או קבצים",
    noneHeadline: "כל תמונה וכל קובץ בצ׳אט הזה נשמרו",
    omittedWhatTextOnly: (n) =>
      n === 1
        ? "תמונה, סרטון או קובץ אחד שהייצוא לא כלל"
        : `${count(n)} תמונות, סרטונים או קבצים שהייצוא לא כלל`,
    omittedWhat: (n) => `${count(n)} שוואטסאפ כבר איבדה`,
    omittedWhyTextOnly:
      "הייצוא הזה נעשה בלי מדיה, ולכן וואטסאפ כתבה סימן מציין במקום כל קובץ. " +
      "הקבצים עדיין נמצאים בוואטסאפ — הם פשוט לא היו חלק מהייצוא הזה.",
    omittedWhy:
      "וואטסאפ כתבה עבורם ‏“image omitted”‏, כלומר הקובץ כבר לא היה בטלפון הזה בזמן הייצוא. " +
      "בדרך כלל זה אומר שהוא נוקה כדי לפנות מקום, שהוא מעולם לא הורד, או שזו הייתה הודעה " +
      "לצפייה חד־פעמית או הודעה נעלמת. הוא נעלם עוד לפני שהאפליקציה הזו ראתה את הצ׳אט.",
    missingWhat: (n) => `${count(n)} שהייצוא הזכיר בשמם אך לא הכיל`,
    missingWhy:
      "הצ׳אט מפנה לקבצים האלה לפי שם, אבל הם לא היו בתוך הקובץ ששיתפתם. " +
      "בדרך כלל זה אומר שהייצוא נקטע — וואטסאפ מפסיקה להוסיף מדיה כשייצוא נעשה גדול.",
    stepReexportWithMedia:
      "ייצאו את הצ׳אט שוב, והפעם בחרו ״צרף מדיה״, ואז שתפו לכאן. " +
      "הוא ימוזג לתוך הארכיון הזה — שום דבר לא ייכפל.",
    stepReexportAfterTruncation:
      "ייצאו את הצ׳אט שוב עם מדיה ושתפו לכאן. ייצוא שני לרוב משלים את הקבצים שהייצוא הזה קטע, " +
      "והמיזוג מוסיף רק את מה שחדש.",
    stepScrollBack:
      "פתחו את הצ׳אט בוואטסאפ וגללו אל התמונות הישנות כדי שיירדו מחדש, ואז ייצאו שוב. " +
      "כל מה שוואטסאפ עדיין מסוגלת להביא ייכלל.",
    stepAskSomeoneElse:
      "בקשו ממישהו אחר בצ׳אט לארכב את העותק שלו. ייתכן שבטלפון שלו עדיין יש קבצים שכבר אין בשלכם, " +
      "והייצוא שלו ימוזג לתוך אותו ארכיון בדיוק.",
    headlineTextOnly: "הייצוא הזה לא כלל את המדיה",
    headlineSome: (n) =>
      n === 1 ? "קובץ אחד לא נשמר" : `${count(n)} קבצים לא הצליחו להישמר`,
    stillSaved:
      "ההודעות עצמן בטוחות. מי שלח אותן, מתי, וכל כיתוב שנכתב יחד עם התמונה — הכול נמצא בארכיון. " +
      "רק הקובץ עצמו חסר.",
  },
};

export function explainMedia(
  stats: MediaStats,
  exportHadMedia: boolean,
  language: Language = "en",
): MediaExplanation {
  const { omittedCount, missingCount, notArchivedCount, attachedCount, uniqueBlobCount } = stats;
  const copy = COPY[language];

  const saved = uniqueBlobCount === 0 ? copy.noMedia : copy.savedFiles(uniqueBlobCount);

  if (notArchivedCount === 0) {
    return {
      severity: "none",
      headline:
        stats.totalMediaMessages === 0 ? copy.noneHeadlineEmpty : copy.noneHeadline,
      saved,
      causes: [],
      nextSteps: [],
    };
  }

  // Nothing attached at all, and media messages exist: this is what a text-only export looks
  // like from here. Worth separating, because it is the one case with a complete fix.
  const nothingAttached = attachedCount === 0 && omittedCount > 0;
  const looksLikeTextOnlyExport = nothingAttached && !exportHadMedia;

  const causes: LossCause[] = [];

  if (omittedCount > 0) {
    causes.push({
      count: omittedCount,
      what: looksLikeTextOnlyExport
        ? copy.omittedWhatTextOnly(omittedCount)
        : copy.omittedWhat(omittedCount),
      why: looksLikeTextOnlyExport ? copy.omittedWhyTextOnly : copy.omittedWhy,
    });
  }

  if (missingCount > 0) {
    causes.push({
      count: missingCount,
      what: copy.missingWhat(missingCount),
      why: copy.missingWhy,
    });
  }

  const nextSteps: string[] = [];
  if (looksLikeTextOnlyExport) {
    nextSteps.push(copy.stepReexportWithMedia);
  } else {
    if (missingCount > 0) nextSteps.push(copy.stepReexportAfterTruncation);
    if (omittedCount > 0) nextSteps.push(copy.stepScrollBack);
  }
  nextSteps.push(copy.stepAskSomeoneElse);

  return {
    severity: looksLikeTextOnlyExport || attachedCount === 0 ? "all" : "some",
    headline: looksLikeTextOnlyExport
      ? copy.headlineTextOnly
      : copy.headlineSome(notArchivedCount),
    saved,
    causes,
    stillSaved: copy.stillSaved,
    nextSteps,
  };
}

function count(value: number): string {
  return value.toLocaleString("en-US");
}
