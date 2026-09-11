/**
 * Every user-facing string in the app, in both languages.
 *
 * **English is the source of truth and Hebrew is checked against it by the compiler.** `he` is
 * typed as `Record<StringKey, string>` where `StringKey` is derived from `en`, so adding an
 * English string without its Hebrew counterpart fails `pnpm typecheck` rather than shipping a
 * screen that is half-translated. That check is the whole reason the catalogue is one file
 * instead of one per screen.
 *
 * Interpolation is `{name}` placeholders filled by `t()`. Plurals are two keys, `.one` and
 * `.other`, resolved by `tp()`: Hebrew and English agree closely enough on the 1-vs-many split
 * that a full plural-rules engine would be a dependency bought for nothing.
 *
 * Two rules the Hebrew has to keep, both of them product invariants rather than style:
 *
 * - **Nothing may claim the app deletes anything from WhatsApp or frees storage** (root
 *   CLAUDE.md, invariant 1). The Hebrew says מוחקים בעצמכם / "you delete it yourselves"
 *   wherever the English says the app guides rather than acts.
 * - **Nothing may imply anything is sent to our servers**, and a copy in the user's Google Drive
 *   is always named as *their* Drive. "on this phone" / "בטלפון הזה" is still load-bearing
 *   copy, not reassurance boilerplate.
 *
 * The media-gap wording is *not* here: it is computed from counts in `lib/ui/media-explanation.ts`,
 * which carries both languages beside the logic that chooses between them, and is tested.
 */

export const APP_NAME = { en: "Boydem", he: "בוידעם" } as const;

const en = {
  // ── Tabs ────────────────────────────────────────────────────────────────────────────────
  "tabs.chats": "Chats",
  "tabs.add": "Add",
  "tabs.account": "Account",
  "tabs.settings": "Settings",

  // ── Shared ──────────────────────────────────────────────────────────────────────────────
  "common.backToLibrary": "Back to library",
  "common.done": "Done",
  "common.cancel": "Cancel",
  "common.showFewer": "Show fewer",
  "common.showAll": "Show all {count}",
  "common.viewAll": "View all {count}",
  "common.unknown": "Unknown",
  "common.messages.one": "{count} message",
  "common.messages.other": "{count} messages",
  "common.files.one": "{count} file",
  "common.files.other": "{count} files",

  // ── Library ─────────────────────────────────────────────────────────────────────────────
  "library.title": "Chats",
  "library.empty.heading": "No chats yet",
  "library.empty.cta": "How to add a chat",

  // ── Add tab ─────────────────────────────────────────────────────────────────────────────
  "add.title": "Add a chat",
  "add.step.1": "Open the chat in WhatsApp.",
  "add.step.2": "Tap its name at the top.",
  "add.step.3": "Tap Export Chat.",
  "add.step.4": "Choose Attach Media.",
  "add.step.5": "Pick {app}.",

  // ── Account tab ─────────────────────────────────────────────────────────────────────────
  "account.title": "Account",
  "backup.now": "Back up now",
  "backup.retry": "Try again",
  "backup.diverged":
    "Changed from another phone — left as is",
  "backup.failed": "Upload didn't finish",
  "account.drive.title": "Google Drive",
  "account.drive.connect": "Connect Google Drive",
  "account.drive.disconnect": "Disconnect",
  "account.drive.backupAll": "Back up all chats",
  "account.drive.restore": "Download {count} from Drive",
  "account.drive.restoring": "Downloading {n} of {count}…",

  // ── Settings tab ────────────────────────────────────────────────────────────────────────
  "settings.title": "Settings",
  "settings.language.title": "Language",
  "settings.language.he": "עברית",
  "settings.language.en": "English",
  "settings.language.restart":
    "The text changed straight away, but the app has to be relaunched before the layout flips direction. Close it fully and open it again.",
  "settings.appearance.title": "Appearance",
  "settings.appearance.system": "Automatic",
  "settings.appearance.light": "Light",
  "settings.appearance.dark": "Dark",
  "settings.about.version": "Version",
  "settings.dev.title": "Developer",
  "settings.dev.checks": "Run the device checks",
  "settings.dev.checksNote":
    "The storage contract and the crypto pipeline, run inside this runtime. Dev builds only.",

  // ── Import ──────────────────────────────────────────────────────────────────────────────
  "import.title": "Import",
  "import.reading": "Reading the export…",
  "import.stage.deriving-key": "Securing…",
  "import.stage.parsing": "Reading messages…",
  "import.stage.checking-media": "Checking media…",
  "import.stage.writing": "Saving…",
  "import.stage.verifying": "Checking it saved…",
  "import.unlock.heading": "Passphrase for {chat}",
  "import.field.passphrase": "Passphrase",
  "import.field.again": "Type it again",
  "import.field.mismatch": "These do not match.",
  // Mirrors `WeakPassphraseError`, which stays English because it is a thrown error read by
  // developers and tests. What the user sees under the field is this.
  "import.field.tooShort":
    "Use at least 8 characters. This passphrase is the only way back into the archive.",
  "import.submit.merge": "Add to chat",
  "import.error.wrongPassphrase": "That passphrase does not open this archive.",
  "import.error.unfinished": "The import did not finish.",
  "import.error.unreadable": "This export could not be read.",
  "import.error.noFile": "No file arrived with the share.",
  "import.error.reassurance":
    "Nothing changed in WhatsApp.",

  // ── Verify ──────────────────────────────────────────────────────────────────────────────
  "verify.title": "What was captured",
  "verify.nothing.heading": "Nothing to verify",
  "verify.row.messages": "Messages",
  "verify.row.mediaFiles": "Media files",
  "verify.cta.read": "Open chat",
  "verify.cta.delete": "Delete it in WhatsApp",

  // ── Guided delete ───────────────────────────────────────────────────────────────────────
  "deleteGuide.title": "Delete in WhatsApp",
  "deleteGuide.heading": "Delete “{chat}” in WhatsApp",
  "deleteGuide.theChat": "the chat",
  "deleteGuide.ios.1": "Open WhatsApp and find the chat in your Chats list.",
  "deleteGuide.ios.2": "Swipe left on it, then tap More.",
  "deleteGuide.ios.3": "Tap Delete Chat, and confirm.",
  "deleteGuide.ios.4": "To reclaim the space now: Settings → Storage and Data → Manage Storage.",
  "deleteGuide.android.1": "Open WhatsApp and find the chat in your Chats list.",
  "deleteGuide.android.2": "Press and hold the chat until it is selected.",
  "deleteGuide.android.3": "Tap the bin icon at the top, and confirm.",
  "deleteGuide.android.4": "To reclaim the space now: Settings → Storage and data → Manage storage.",
  "deleteGuide.confirm": "I deleted it",

  // ── Archive reader ──────────────────────────────────────────────────────────────────────
  "reader.title": "Archive",
  "reader.opening": "Opening...",
  "reader.deriving": "Deriving the key...",
  "reader.locked.title": "Locked",
  "reader.locked.heading": "This archive is locked",
  "reader.locked.body":
    "Its key is not in this phone's keychain — normal after a restore, a reinstall, or if the archive came from another device. Your passphrase opens it, and puts the key back.",
  "reader.locked.unlock": "Unlock",
  "reader.error.heading": "This archive did not open",
  "reader.error.warning": "If you have not deleted this chat in WhatsApp yet, do not delete it.",
  "reader.info": "Info",
  "reader.infoLabel": "Chat information",
  "reader.beginning": "The beginning of this archive · {messages}",

  // ── Message bubbles ─────────────────────────────────────────────────────────────────────
  "bubble.notInExport": "This file was named in the chat but was not in the export.",
  "bubble.omitted": "WhatsApp left this media out of the export — it is not in the archive.",
  "bubble.deleted": "This message was deleted",
  "bubble.damaged": "This photo is damaged.",
  "bubble.unreachable": "Couldn't load this photo from Drive.",
  "bubble.kind.video": "Video",
  "bubble.kind.audio": "Voice or audio",
  "bubble.kind.file": "File",
  "bubble.notPlayable": "Saved in the archive. Playback is not built yet.",
  "bubble.photoFrom": "Photo from {sender}",
  "preview.photoOrFile": "Photo or file",
  "preview.mediaMissing": "Media not in the archive",
  "preview.deleted": "Deleted message",

  // ── Chat info ───────────────────────────────────────────────────────────────────────────
  "info.title": "Chat info",
  "chatPhoto.use": "Use as chat photo",
  "chatPhoto.current": "Chat photo ✓",
  "chatPhoto.remove": "Remove photo",
  "chatPhoto.hint": "Open a photo to use it as the chat's picture.",
  "info.locked": "This archive is locked. Open it from the library and enter your passphrase.",
  "info.error.heading": "Could not read this archive",
  "info.media.title": "Media ({count})",
  "info.media.seeAll": "See all",
  "info.media.facts": "{files} · {size}",
  "info.people.one": "{count} participant",
  "info.people.other": "{count} participants",
  "info.people.hint":
    "Tap yourself.",
  "info.people.you": "You",

  // ── Media gallery ───────────────────────────────────────────────────────────────────────
  "media.title": "Media",
  "media.titleCount": "Media ({count})",
  "media.header": "{photos} · {size} in this archive",
  "media.photos.one": "{count} photo",
  "media.photos.other": "{count} photos",
  "media.otherKinds.one":
    "{count} video or audio file is also archived. It cannot be played in the app yet — it is in the file, and the web viewer can open it.",
  "media.otherKinds.other":
    "{count} videos and audio files are also archived. They cannot be played in the app yet — they are in the file, and the web viewer can open them.",
  "media.empty": "This archive holds no photos. Anything the export carried would appear here.",

  // ── Removing an archive ─────────────────────────────────────────────────────────────────
  "remove.title": "Remove this archive?",
  "remove.broken.body":
    "It doesn't open, so nothing is lost.",
  "remove.locked.body":
    "It's protected and its key isn't on this phone. Removing it leaves only your Drive copy, if there is one.",
  "remove.ready.body":
    "Removes it from this phone. Your Drive copy, if there is one, stays.",
  "remove.ready.confirm": "I understand",
  "remove.cta": "Remove from this phone",
  "remove.working": "Removing...",
  "remove.failed": "Could not remove this archive: {error}",
  "remove.noteWhatsApp":
    "Nothing changes in WhatsApp.",

  // ── Device checks (dev-only) ────────────────────────────────────────────────────────────
  "dev.title": "Storage contract",

  // ── Added in the 2026-09-11 simplification ─────────────────────────────────────────
  "status.device": "On this phone",
  "drive.protectedFolder": "Protected chat",
  "backup.open": "Open",
  "status.uploading": "Uploading {percent}%",
  "status.safe": "Safe to delete",
  "status.deleted": "Deleted · in Drive",
  "library.count.one": "{count} chat",
  "library.count.other": "{count} chats",
  "common.chats.one": "one chat",
  "common.chats.other": "{count} chats",
  "common.learnMore": "Learn more",
  "common.showLess": "Show less",
  "library.locked": "Protected chat",
  "library.locked.hint": "Tap to open it with its passphrase",
  "library.unreadable": "This chat doesn't open",
  "add.after": "The chat opens here by itself.",
  "import.protect": "Protect with a passphrase",
  "import.protect.warning": "If you forget it, the chat can't be opened. There's no reset.",
  "import.save": "Save chat",
  "verify.saved": "Saved",
  "verify.nothingNew": "Already up to date",
  "verify.added": "{count} new",
  "verify.issues": "{count} lines couldn't be read",
  "media.note": "{count} photos or files weren't in the export — that's normal.",
  "media.note.dismiss": "Don't remind me",
  "backup.onlyPhone": "Only on this phone",
  "backup.connect": "Connect Drive",
  "backup.uploading": "Uploading to Drive · {percent}%",
  "backup.inDrive": "In your Google Drive",
  "info.drive": "Backup",
  "info.passphrase": "Passphrase",
  "info.passphrase.on": "On",
  "info.passphrase.off": "Off",
  "account.drive.pitch": "Keep a copy of your chats in your own Google Drive.",
  "account.drive.account": "Account",
  "account.backedUp": "{count} backed up",
  "account.backedUpSome": "{ok} backed up, {failed} didn't finish",
  "account.restored": "Done — they're in your chats.",
  "settings.chats.title": "Chats",
  "settings.protectNewChats": "Protect new chats with a passphrase",
  "settings.mediaNote": "Remind me about media not in the export",
  "settings.help": "Help & privacy",
  "help.title": "Help",
  "help.how.title": "How it works",
  "help.how.body": "Export a chat from WhatsApp and share it to {app}. It's saved on this phone — and, if you connect Google Drive, copied to your own Drive.\n\nWhen a chat shows “Safe to delete”, its latest version is in your Drive, and you can delete it in WhatsApp to free up space. {app} never deletes anything itself — it can't.",
  "help.privacy.title": "Privacy & passphrases",
  "help.privacy.body": "Your chats are never sent to our servers.\n\nBy default a chat is saved as ordinary files — on this phone and in your Drive — so you can open it without {app}, including a readable chat.txt. Anyone with access to your Google account can read it, like any other file there.\n\nIf you'd rather, turn on “Protect with a passphrase” when saving a chat, or make it the default in Settings. A protected chat is encrypted before it's written and opens only with its passphrase. Keep the passphrase somewhere safe: there's no way to reset it.",
  "help.media.title": "Photos and files that weren't saved",
  "help.media.body": "Sometimes an export doesn't include every photo or video. WhatsApp leaves out media that's no longer on your phone, and an export made without media has none at all. That's normal.\n\nAll the messages are saved, and each missing file is marked where it was. If a file matters to you, save it from WhatsApp before deleting the chat. You can turn this reminder off in Settings.",
  "help.drive.title": "Google Drive",
  "help.drive.body": "Connect your Google account on the Account tab. {app} can only see the files it creates, in a folder called {app}.\n\nChats back up by themselves after you save them. To move to a new phone, connect the same account and download your chats from the Account tab.\n\nRemoving a chat from this phone doesn't touch the copy in your Drive.",
  "help.delete.title": "Deleting from WhatsApp",
  "help.delete.body": "{app} can't delete anything from WhatsApp — no app can. When a chat is safe to delete, open it and tap “Delete it in WhatsApp” for the steps.\n\nWhen you're done, tick “I deleted it” so the chat shows as deleted.",
  "help.merge.title": "Adding the same chat again",
  "help.merge.body": "Sharing the same chat again is safe: new messages are added and nothing is duplicated.\n\nEveryone in a group can export their own copy and add it — together they reach further back than any single export.",
  "help.limits.title": "WhatsApp's limits",
  "help.limits.body": "WhatsApp exports at most about 40,000 messages — or 10,000 with media — counting back from the newest. Export again later to add what's new.",
  "help.about.title": "About {app}",
  "help.about.body": "{app} turns a WhatsApp export into a copy you own, then shows you how to delete the original yourself.",
} as const;

export type StringKey = keyof typeof en;

const he: Record<StringKey, string> = {
  // ── Tabs ────────────────────────────────────────────────────────────────────────────────
  "tabs.chats": "צ׳אטים",
  "tabs.add": "הוספה",
  "tabs.account": "חשבון",
  "tabs.settings": "הגדרות",

  // ── Shared ──────────────────────────────────────────────────────────────────────────────
  "common.backToLibrary": "חזרה לספרייה",
  "common.done": "סיום",
  "common.cancel": "ביטול",
  "common.showFewer": "הצגה מצומצמת",
  "common.showAll": "הצגת כל ה־{count}",
  "common.viewAll": "הצגת כל ה־{count}",
  "common.unknown": "לא ידוע",
  "common.messages.one": "הודעה אחת",
  "common.messages.other": "{count} הודעות",
  "common.files.one": "קובץ אחד",
  "common.files.other": "{count} קבצים",

  // ── Library ─────────────────────────────────────────────────────────────────────────────
  "library.title": "צ׳אטים",
  "library.empty.heading": "עדיין אין צ׳אטים",
  "library.empty.cta": "איך מוסיפים צ׳אט",

  // ── Add tab ─────────────────────────────────────────────────────────────────────────────
  "add.title": "הוספת צ׳אט",
  "add.step.1": "פתחו את הצ׳אט בוואטסאפ.",
  "add.step.2": "הקישו על השם שלו למעלה.",
  "add.step.3": "הקישו על ״ייצוא צ׳אט״.",
  "add.step.4": "בחרו ״צירוף מדיה״.",
  "add.step.5": "בחרו ב{app}.",

  // ── Account tab ─────────────────────────────────────────────────────────────────────────
  "account.title": "חשבון",
  "backup.now": "גיבוי עכשיו",
  "backup.retry": "ניסיון נוסף",
  "backup.diverged":
    "שונה מטלפון אחר — נשאר כמו שהוא",
  "backup.failed": "ההעלאה לא הושלמה",
  "account.drive.title": "Google Drive",
  "account.drive.connect": "חיבור Google Drive",
  "account.drive.disconnect": "ניתוק",
  "account.drive.backupAll": "גיבוי כל הצ׳אטים",
  "account.drive.restore": "הורדת {count} מ-Drive",
  "account.drive.restoring": "מוריד {n} מתוך {count}…",

  // ── Settings tab ────────────────────────────────────────────────────────────────────────
  "settings.title": "הגדרות",
  "settings.language.title": "שפה",
  "settings.language.he": "עברית",
  "settings.language.en": "English",
  "settings.language.restart":
    "הטקסט התחלף מיד, אבל כדי שכיוון הפריסה יתהפך צריך להפעיל את האפליקציה מחדש. סגרו אותה לגמרי ופתחו שוב.",
  "settings.appearance.title": "מראה",
  "settings.appearance.system": "אוטומטי",
  "settings.appearance.light": "בהיר",
  "settings.appearance.dark": "כהה",
  "settings.about.version": "גרסה",
  "settings.dev.title": "פיתוח",
  "settings.dev.checks": "הרצת בדיקות המכשיר",
  "settings.dev.checksNote":
    "חוזה האחסון וצינור ההצפנה, רצים בתוך סביבת הריצה הזו. בגרסאות פיתוח בלבד.",

  // ── Import ──────────────────────────────────────────────────────────────────────────────
  "import.title": "ייבוא",
  "import.reading": "קוראים את הייצוא…",
  "import.stage.deriving-key": "מאבטחים…",
  "import.stage.parsing": "קוראים הודעות…",
  "import.stage.checking-media": "בודקים מדיה…",
  "import.stage.writing": "שומרים…",
  "import.stage.verifying": "מוודאים שנשמר…",
  "import.unlock.heading": "סיסמת המעבר של {chat}",
  "import.field.passphrase": "סיסמת מעבר",
  "import.field.again": "הקלידו שוב",
  "import.field.mismatch": "השתיים לא זהות.",
  "import.field.tooShort":
    "השתמשו ב־8 תווים לפחות. סיסמת המעבר הזו היא הדרך היחידה חזרה אל הארכיון.",
  "import.submit.merge": "הוספה לצ׳אט",
  "import.error.wrongPassphrase": "סיסמת המעבר הזו לא פותחת את הארכיון.",
  "import.error.unfinished": "הייבוא לא הסתיים.",
  "import.error.unreadable": "לא הצלחנו לקרוא את הייצוא הזה.",
  "import.error.noFile": "לא הגיע שום קובץ עם השיתוף.",
  "import.error.reassurance":
    "שום דבר לא השתנה בוואטסאפ.",

  // ── Verify ──────────────────────────────────────────────────────────────────────────────
  "verify.title": "מה נשמר",
  "verify.nothing.heading": "אין מה לאמת",
  "verify.row.messages": "הודעות",
  "verify.row.mediaFiles": "קובצי מדיה",
  "verify.cta.read": "פתיחת הצ׳אט",
  "verify.cta.delete": "מחיקה בוואטסאפ",

  // ── Guided delete ───────────────────────────────────────────────────────────────────────
  "deleteGuide.title": "מחיקה בוואטסאפ",
  "deleteGuide.heading": "מחיקת ״{chat}״ בוואטסאפ",
  "deleteGuide.theChat": "הצ׳אט",
  "deleteGuide.ios.1": "פתחו את וואטסאפ ומצאו את הצ׳אט ברשימת הצ׳אטים.",
  "deleteGuide.ios.2": "החליקו עליו שמאלה והקישו על ״עוד״.",
  "deleteGuide.ios.3": "הקישו על ״מחק צ׳אט״ ואשרו.",
  "deleteGuide.ios.4": "כדי לפנות את המקום עכשיו: הגדרות ← אחסון ונתונים ← ניהול אחסון.",
  "deleteGuide.android.1": "פתחו את וואטסאפ ומצאו את הצ׳אט ברשימת הצ׳אטים.",
  "deleteGuide.android.2": "לחצו לחיצה ארוכה על הצ׳אט עד שהוא נבחר.",
  "deleteGuide.android.3": "הקישו על סמל הפח למעלה ואשרו.",
  "deleteGuide.android.4": "כדי לפנות את המקום עכשיו: הגדרות ← אחסון ונתונים ← ניהול אחסון.",
  "deleteGuide.confirm": "מחקתי",

  // ── Archive reader ──────────────────────────────────────────────────────────────────────
  "reader.title": "ארכיון",
  "reader.opening": "פותחים...",
  "reader.deriving": "גוזרים את המפתח...",
  "reader.locked.title": "נעול",
  "reader.locked.heading": "הארכיון הזה נעול",
  "reader.locked.body":
    "המפתח שלו לא נמצא במחזיק המפתחות של הטלפון — מצב רגיל אחרי שחזור מגיבוי, התקנה מחדש, או אם הארכיון הגיע ממכשיר אחר. סיסמת המעבר שלכם פותחת אותו ומחזירה את המפתח למקומו.",
  "reader.locked.unlock": "פתיחה",
  "reader.error.heading": "הארכיון הזה לא נפתח",
  "reader.error.warning": "אם עוד לא מחקתם את הצ׳אט הזה בוואטסאפ — אל תמחקו.",
  "reader.info": "מידע",
  "reader.infoLabel": "מידע על הצ׳אט",
  "reader.beginning": "תחילת הארכיון הזה · {messages}",

  // ── Message bubbles ─────────────────────────────────────────────────────────────────────
  "bubble.notInExport": "הקובץ הזה הוזכר בצ׳אט אבל לא נכלל בייצוא.",
  "bubble.omitted": "וואטסאפ השאירה את המדיה הזו מחוץ לייצוא — היא לא נמצאת בארכיון.",
  "bubble.deleted": "ההודעה הזו נמחקה",
  "bubble.damaged": "התמונה הזו פגומה.",
  "bubble.unreachable": "לא הצלחנו לטעון את התמונה מ-Drive.",
  "bubble.kind.video": "וידאו",
  "bubble.kind.audio": "הקלטה או אודיו",
  "bubble.kind.file": "קובץ",
  "bubble.notPlayable": "שמור בארכיון. נגינה עדיין לא נבנתה.",
  "bubble.photoFrom": "תמונה מ{sender}",
  "preview.photoOrFile": "תמונה או קובץ",
  "preview.mediaMissing": "מדיה שאינה בארכיון",
  "preview.deleted": "הודעה שנמחקה",

  // ── Chat info ───────────────────────────────────────────────────────────────────────────
  "info.title": "מידע על הצ׳אט",
  "chatPhoto.use": "הגדרה כתמונת הצ׳אט",
  "chatPhoto.current": "תמונת הצ׳אט ✓",
  "chatPhoto.remove": "הסרת התמונה",
  "chatPhoto.hint": "פתחו תמונה כדי להשתמש בה כתמונת הצ׳אט.",
  "info.locked": "הארכיון הזה נעול. פתחו אותו מהספרייה והזינו את סיסמת המעבר.",
  "info.error.heading": "לא הצלחנו לקרוא את הארכיון הזה",
  "info.media.title": "מדיה ({count})",
  "info.media.seeAll": "הצגת הכול",
  "info.media.facts": "{files} · {size}",
  "info.people.one": "משתתף אחד",
  "info.people.other": "{count} משתתפים",
  "info.people.hint":
    "הקישו על עצמכם.",
  "info.people.you": "אתם",

  // ── Media gallery ───────────────────────────────────────────────────────────────────────
  "media.title": "מדיה",
  "media.titleCount": "מדיה ({count})",
  "media.header": "{photos} · {size} בארכיון הזה",
  "media.photos.one": "תמונה אחת",
  "media.photos.other": "{count} תמונות",
  "media.otherKinds.one":
    "גם קובץ וידאו או אודיו אחד שמור בארכיון. אי אפשר לנגן אותו באפליקציה עדיין — הוא נמצא בקובץ, והצפיין באינטרנט יכול לפתוח אותו.",
  "media.otherKinds.other":
    "גם {count} קובצי וידאו ואודיו שמורים בארכיון. אי אפשר לנגן אותם באפליקציה עדיין — הם נמצאים בקובץ, והצפיין באינטרנט יכול לפתוח אותם.",
  "media.empty": "אין בארכיון הזה תמונות. כל מה שהייצוא נשא היה מופיע כאן.",

  // ── Removing an archive ─────────────────────────────────────────────────────────────────
  "remove.title": "להסיר את הארכיון הזה?",
  "remove.broken.body":
    "הוא לא נפתח, כך ששום דבר לא יאבד.",
  "remove.locked.body":
    "הצ׳אט מוגן והמפתח שלו לא בטלפון הזה. אחרי ההסרה יישאר רק העותק ב-Drive, אם יש.",
  "remove.ready.body":
    "מסיר מהטלפון הזה. העותק ב-Drive, אם יש, נשאר.",
  "remove.ready.confirm": "הבנתי",
  "remove.cta": "הסרה מהטלפון הזה",
  "remove.working": "מסירים...",
  "remove.failed": "לא הצלחנו להסיר את הארכיון הזה: {error}",
  "remove.noteWhatsApp":
    "שום דבר לא משתנה בוואטסאפ.",

  // ── Device checks (dev-only) ────────────────────────────────────────────────────────────
  "dev.title": "חוזה האחסון",

  // ── Added in the 2026-09-11 simplification ─────────────────────────────────────────
  "status.device": "בטלפון הזה",
  "drive.protectedFolder": "צ׳אט מוגן",
  "backup.open": "פתיחה",
  "status.uploading": "מעלה {percent}%",
  "status.safe": "אפשר למחוק",
  "status.deleted": "נמחק · ב-Drive",
  "library.count.one": "צ׳אט אחד",
  "library.count.other": "{count} צ׳אטים",
  "common.chats.one": "צ׳אט אחד",
  "common.chats.other": "{count} צ׳אטים",
  "common.learnMore": "למידע נוסף",
  "common.showLess": "פחות",
  "library.locked": "צ׳אט מוגן",
  "library.locked.hint": "הקישו כדי לפתוח עם סיסמת המעבר",
  "library.unreadable": "הצ׳אט הזה לא נפתח",
  "add.after": "הצ׳אט ייפתח כאן מעצמו.",
  "import.protect": "הגנה בסיסמת מעבר",
  "import.protect.warning": "אם תשכחו אותה, לא יהיה אפשר לפתוח את הצ׳אט. אין איפוס.",
  "import.save": "שמירת הצ׳אט",
  "verify.saved": "נשמר",
  "verify.nothingNew": "כבר מעודכן",
  "verify.added": "{count} חדשות",
  "verify.issues": "{count} שורות לא נקראו",
  "media.note": "{count} תמונות או קבצים לא היו בייצוא — זה רגיל.",
  "media.note.dismiss": "אל תזכירו לי",
  "backup.onlyPhone": "רק בטלפון הזה",
  "backup.connect": "חיבור Drive",
  "backup.uploading": "מעלה ל-Drive · {percent}%",
  "backup.inDrive": "ב-Google Drive שלכם",
  "info.drive": "גיבוי",
  "info.passphrase": "סיסמת מעבר",
  "info.passphrase.on": "מופעלת",
  "info.passphrase.off": "כבויה",
  "account.drive.pitch": "שמרו עותק של הצ׳אטים ב-Google Drive שלכם.",
  "account.drive.account": "חשבון",
  "account.backedUp": "{count} גובו",
  "account.backedUpSome": "{ok} גובו, {failed} לא הושלמו",
  "account.restored": "הסתיים — הם ברשימת הצ׳אטים.",
  "settings.chats.title": "צ׳אטים",
  "settings.protectNewChats": "הגנה על צ׳אטים חדשים בסיסמת מעבר",
  "settings.mediaNote": "תזכורת על מדיה שלא הייתה בייצוא",
  "settings.help": "עזרה ופרטיות",
  "help.title": "עזרה",
  "help.how.title": "איך זה עובד",
  "help.how.body": "מייצאים צ׳אט מוואטסאפ ומשתפים אותו ל{app}. הוא נשמר בטלפון הזה — ואם חיברתם את Google Drive, מועתק גם ל-Drive שלכם.\n\nכשצ׳אט מסומן ״אפשר למחוק״, הגרסה העדכנית שלו נמצאת ב-Drive, ואפשר למחוק אותו בוואטסאפ כדי לפנות מקום. {app} אף פעם לא מוחקת כלום בעצמה — היא לא יכולה.",
  "help.privacy.title": "פרטיות וסיסמאות מעבר",
  "help.privacy.body": "הצ׳אטים שלכם אף פעם לא נשלחים לשרתים שלנו.\n\nכברירת מחדל צ׳אט נשמר כקבצים רגילים — בטלפון הזה וב-Drive שלכם — כך שאפשר לפתוח אותו גם בלי {app}, כולל קובץ chat.txt קריא. מי שיש לו גישה לחשבון הגוגל שלכם יכול לקרוא אותו, כמו כל קובץ אחר שם.\n\nאם אתם מעדיפים, הפעילו ״הגנה בסיסמת מעבר״ כששומרים צ׳אט, או הגדירו את זה כברירת מחדל בהגדרות. צ׳אט מוגן מוצפן לפני שהוא נכתב, ונפתח רק עם סיסמת המעבר שלו. שמרו אותה במקום בטוח: אין דרך לאפס אותה.",
  "help.media.title": "תמונות וקבצים שלא נשמרו",
  "help.media.body": "לפעמים ייצוא לא כולל כל תמונה או סרטון. וואטסאפ משמיטה מדיה שכבר לא נמצאת בטלפון, וייצוא בלי מדיה לא כולל מדיה בכלל. זה רגיל.\n\nכל ההודעות נשמרות, וכל קובץ חסר מסומן במקום שבו היה. אם קובץ מסוים חשוב לכם, שמרו אותו מוואטסאפ לפני שמוחקים את הצ׳אט. אפשר לכבות את התזכורת הזו בהגדרות.",
  "help.drive.title": "Google Drive",
  "help.drive.body": "מחברים את חשבון הגוגל בלשונית החשבון. {app} רואה רק את הקבצים שהיא יוצרת, בתיקייה בשם {app}.\n\nצ׳אטים מגובים מעצמם אחרי שמירה. כדי לעבור לטלפון חדש, מחברים את אותו חשבון ומורידים את הצ׳אטים מלשונית החשבון.\n\nהסרת צ׳אט מהטלפון הזה לא נוגעת בעותק שב-Drive.",
  "help.delete.title": "מחיקה מוואטסאפ",
  "help.delete.body": "{app} לא יכולה למחוק שום דבר מוואטסאפ — אף אפליקציה לא יכולה. כשצ׳אט מוכן למחיקה, פתחו אותו והקישו ״מחיקה בוואטסאפ״ כדי לראות את השלבים.\n\nבסוף סמנו ״מחקתי״, והצ׳אט יסומן כנמחק.",
  "help.merge.title": "הוספת אותו צ׳אט שוב",
  "help.merge.body": "שיתוף של אותו צ׳אט שוב הוא בטוח: הודעות חדשות נוספות ושום דבר לא מוכפל.\n\nכל אחד בקבוצה יכול לייצא עותק משלו ולהוסיף אותו — יחד הם מגיעים רחוק יותר אחורה מכל ייצוא לבד.",
  "help.limits.title": "המגבלות של וואטסאפ",
  "help.limits.body": "וואטסאפ מייצאת לכל היותר כ-40,000 הודעות — או 10,000 עם מדיה — מהחדשה ביותר אחורה. ייצוא נוסף בהמשך מוסיף את מה שחדש.",
  "help.about.title": "על {app}",
  "help.about.body": "{app} הופכת ייצוא מוואטסאפ לעותק שהוא שלכם, ואז מראה לכם איך למחוק את המקור בעצמכם.",
};

export const catalogue = { en, he } as const;
