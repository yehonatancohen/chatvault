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
  "common.delete": "Delete",
  "common.remove": "Remove",
  "common.showFewer": "Show fewer",
  "common.showAll": "Show all {count}",
  "common.viewAll": "View all {count}",
  "common.unknown": "Unknown",
  "common.messages.one": "{count} message",
  "common.messages.other": "{count} messages",
  "common.files.one": "{count} file",
  "common.files.other": "{count} files",
  "common.people.one": "{count} person",
  "common.people.other": "{count} people",
  "common.archives.one": "one archive",
  "common.archives.other": "{count} archives",
  "common.and": "and",
  "common.andOthers": "{names} and {count} others",
  "common.noOne": "No one",

  // ── Library ─────────────────────────────────────────────────────────────────────────────
  "library.title": "Chats",
  "library.hero.line":
    "of media, kept across {archives} you own — encrypted on this phone, stored where you chose.",
  "library.heading.one": "{count} archive",
  "library.heading.other": "{count} archives",
  "library.addMore":
    "To add to an archive — or to start another — export a chat in WhatsApp and share it here. An export of a chat you have already archived is merged in, not duplicated.",
  "library.holdToManage": "Press and hold a chat to remove it from this phone.",
  "library.storage.title": "Where these are saved",
  "library.storage.more":
    "Open a chat and tap Info for the full picture, including what happens to your archive when you back up or replace your phone.",
  "library.card.locked.title": "Locked archive",
  "library.card.locked.body":
    "This phone does not hold the key for this archive — after a restore or a reinstall, that is normal. Open it and enter your passphrase.",
  "library.card.unreadable.title": "This archive does not open",
  "library.card.unreadable.warning":
    "Do not delete this chat in WhatsApp if you have not already.",
  "library.card.imports": "{count} imports",
  "library.empty.heading": "No archives yet",
  "library.empty.body":
    "In WhatsApp, open a chat, tap the chat name, and choose Export chat. Then pick {app} from the share sheet.",
  "library.empty.cta": "How to export a chat",
  "library.dev": "Dev: run the device checks",

  // ── Add tab ─────────────────────────────────────────────────────────────────────────────
  "add.title": "Add a chat",
  "add.lede":
    "{app} has no way to reach into WhatsApp, so a chat gets here one way: you export it and share it in. It takes about a minute.",
  "add.steps.title": "In WhatsApp",
  "add.step.1": "Open the chat you want to keep.",
  "add.step.2": "Tap the chat name at the top to open its info screen.",
  "add.step.3": "Scroll down and tap Export Chat.",
  "add.step.4": "Choose Attach Media — without it you get the text and none of the photos.",
  "add.step.5": "In the share sheet that opens, pick {app}.",
  "add.waiting.title": "Then come back here",
  "add.waiting.body":
    "The import screen opens by itself when the export arrives. Parsing, encrypting and writing all happen on this phone, and nothing is sent to our servers.",
  "add.limits.title": "Two things worth knowing first",
  "add.limits.cap":
    "WhatsApp caps an export at about 40,000 messages, or 10,000 if you include media, counting back from the most recent. Archiving again later picks up where this one stops — and so does anyone else in the group who archives their own copy.",
  "add.limits.noDelete":
    "{app} cannot delete anything from WhatsApp; no app can. Once your archive is saved and verified, we will show you how to delete the chat yourself.",
  "add.merge.title": "Sharing the same chat twice is safe",
  "add.merge.body":
    "An export of a chat you already archived is merged, never duplicated — importing the same file twice changes nothing. That is what lets several people in a group each contribute their own copy.",

  // ── Account tab ─────────────────────────────────────────────────────────────────────────
  "account.title": "Account",
  "account.none.title": "You do not have one, and you do not need one",
  "account.none.body":
    "{app} has no sign-up yet, and nothing you archive is ever sent to our servers. Your archives are encrypted on this phone with a passphrase only you hold — and if you connect Google Drive, the same encrypted files are copied to your own Drive, not ours.",
  "account.why.title": "So what would an account be for?",
  "account.why.body":
    "One thing only: saving archives somewhere other than this phone. Google Drive, iCloud or a link you send to someone else in the chat — each needs somewhere to sign in, and that is when an account starts to exist.",
  "account.why.promise":
    "It will not change where the encryption happens. The key is derived on your device and the server is built so it cannot hold one — a share link carries the key in the part of the URL a browser never sends.",
  "backup.section": "Copy in Google Drive",
  "backup.notConnected":
    "Only on this phone. Connect Google Drive on the Account tab to keep an encrypted copy in your own Drive.",
  "backup.running": "Backing up to your Google Drive…",
  "backup.progress": "{done} of {total}",
  "backup.done": "Backed up to your Google Drive · {when}",
  "backup.never": "Not in your Google Drive yet.",
  "backup.now": "Back up now",
  "backup.retry": "Try again",
  "backup.diverged":
    "The copy in your Drive was changed from another phone since this one last backed it up, so it was left as it is.",
  "backup.failed": "The backup didn't finish ({message}). Trying again picks up where it stopped.",
  "account.drive.title": "Google Drive",
  "account.drive.body":
    "Connect your Google account and {app} can keep your chats in your own Drive, in a folder called {app}. It can only see the files it creates — nothing else in your Drive — and nothing passes through our servers.",
  "account.drive.connect": "Connect Google Drive",
  "account.drive.connected": "Connected as {email}",
  "account.drive.noScope":
    "You signed in, but Drive access wasn't allowed. Connect again and tick Google Drive on Google's screen.",
  "account.drive.disconnect": "Disconnect",
  "account.drive.next": "New chats are backed up to your Drive right after you import them.",
  "account.drive.backupAll": "Back up all chats now",
  "account.drive.backupAllDone": "{ok} backed up",
  "account.drive.backupAllFailed": "{ok} backed up, {failed} not — open a chat to see why",
  "account.drive.restoreFound": "In your Drive but not on this phone: {count}",
  "account.drive.restoreNone": "Every chat in your Drive is already on this phone.",
  "account.drive.restore": "Download them",
  "account.drive.restoring": "Downloading {n} of {count}…",
  "account.drive.restored": "Downloaded. They are in your chats, locked — open each one with its passphrase.",
  "account.drive.error": "Couldn't connect: {message}",
  "account.status.drive": "Google Drive",
  "account.status.driveNone": "Not connected",
  "account.status.title": "Today",
  "account.status.storage": "Storage",
  "account.status.storageValue": "This phone only",
  "account.status.storageDrive": "This phone and your Google Drive",
  "account.status.uploaded": "Sent to our servers",
  "account.status.uploadedValue": "Nothing, ever",
  "account.status.signedIn": "Signed in as",
  "account.status.signedInValue": "No one",
  "account.status.archives": "Archives on this phone",
  "account.footnote":
    "Your Drive holds the same encrypted files as this phone. Anyone who opens them there — Google included — sees nothing without your passphrase.",

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
  "settings.appearance.systemNote": "Automatic follows your phone's own light or dark setting.",
  "settings.storage.title": "Storage",
  "settings.storage.archives": "Archives on this phone",
  "settings.storage.media": "Media held",
  "settings.about.title": "About",
  "settings.about.version": "Version",
  "settings.about.format": "Archive format",
  "settings.about.body":
    "{app} turns a WhatsApp export into an encrypted archive you own, then shows you how to delete the original yourself. It cannot delete anything from WhatsApp, and it never sends your chats to our servers — the only copy outside this phone is the one you choose to keep in your own Google Drive.",
  "settings.dev.title": "Developer",
  "settings.dev.checks": "Run the device checks",
  "settings.dev.checksNote":
    "The storage contract and the crypto pipeline, run inside this runtime. Dev builds only.",

  // ── Import ──────────────────────────────────────────────────────────────────────────────
  "import.title": "Import",
  "import.reading": "Reading the export...",
  "import.stage.deriving-key": "Deriving the key from your passphrase...",
  "import.stage.parsing": "Reading the messages...",
  "import.stage.checking-media": "Checking the media files...",
  "import.stage.writing": "Encrypting and writing...",
  "import.stage.verifying": "Reading the archive back to check it...",
  "import.note.counts": "{messages}, {size} of export.",
  "import.note.writing": "Encrypting every file on this phone — a large export can take a while.",
  "import.note.deriving":
    "Deliberately slow, so a stolen archive cannot be guessed at. Takes a moment.",
  "import.note.local": "Everything happens here; nothing is sent to our servers.",
  "import.onThisPhone": "Everything happens on this phone. Nothing is sent to our servers.",
  "import.choose.heading": "Choose a passphrase",
  "import.unlock.heading": "Unlock {chat}",
  "import.choose.body":
    "This archive is encrypted on this phone before it is written. The passphrase is the only way back into it — from this phone, from a new phone, or from the web viewer in a browser.",
  "import.unlock.body":
    "This export belongs to an archive already on this phone, but its key is not in this phone's keychain. Your passphrase opens it.",
  "import.choose.warning":
    "We cannot reset it and we cannot recover it. Nobody holds a copy — that is what makes the archive yours. Write it down somewhere safe before you continue.",
  "import.field.passphrase": "Passphrase",
  "import.field.placeholder": "At least 8 characters",
  "import.field.again": "Type it again",
  "import.field.confirm": "Confirm passphrase",
  "import.field.mismatch": "These do not match.",
  // Mirrors `WeakPassphraseError`, which stays English because it is a thrown error read by
  // developers and tests. What the user sees under the field is this.
  "import.field.tooShort":
    "Use at least 8 characters. This passphrase is the only way back into the archive.",
  "import.summary.chat": "Chat",
  "import.summary.inExport": "In this export",
  "import.summary.file": "File",
  "import.summary.alreadyArchived": "Already archived",
  "import.summary.alreadyArchivedValue": "{count} of them",
  "import.submit.create": "Create the archive",
  "import.submit.merge": "Unlock and merge",
  "import.error.wrongPassphrase": "That passphrase does not open this archive.",
  "import.error.unfinished": "The import did not finish.",
  "import.error.unreadable": "This export could not be read.",
  "import.error.noFile": "No file arrived with the share.",
  "import.error.reassurance":
    "Nothing was changed in WhatsApp. Your chat is exactly where it was — this app never touches it.",

  // ── Verify ──────────────────────────────────────────────────────────────────────────────
  "verify.title": "What was captured",
  "verify.nothing.heading": "Nothing to verify",
  "verify.nothing.body":
    "This screen shows what an import captured, right after it happens. Open an archive from the library to see what it holds now.",
  "verify.eyebrow.created": "Archive created",
  "verify.eyebrow.merged": "Merged into your archive",
  "verify.lede.created": "{messages} are now encrypted on this phone.",
  "verify.lede.added": "{added} new messages added — {total} in the archive now.",
  "verify.lede.nothingNew":
    "Nothing new in this export. The archive already had all {total} of these messages.",
  "verify.holds": "What the archive holds",
  "verify.row.messages": "Messages",
  "verify.row.dateRange": "Date range",
  "verify.row.people": "People",
  "verify.row.peopleCount": "People ({count})",
  "verify.row.mediaFiles": "Media files",
  "verify.row.mediaSize": "Media size",
  "verify.row.dedup": "Saved by dedup",
  "verify.nextSteps": "What can still be done",
  "verify.issues.title": "Lines the parser could not read",
  "verify.issues.body":
    "{count} of them. They were kept as text rather than dropped, but if this number is large the archive may not match what you see in WhatsApp — worth checking before you delete anything.",
  "verify.check.title": "Check this yourself",
  "verify.check.body":
    "Open the chat in WhatsApp and compare. The message count and the dates above should match what is there. If they do not, do not delete the chat — tell us instead.",
  "verify.cta.read": "Read the archive",
  "verify.cta.delete": "Now delete the chat in WhatsApp",
  "verify.footnote":
    "{app} cannot delete anything from WhatsApp — no app can. The next screen shows you how to do it yourself, once you are satisfied with what is above.",

  // ── Guided delete ───────────────────────────────────────────────────────────────────────
  "deleteGuide.title": "Delete in WhatsApp",
  "deleteGuide.heading": "Deleting {chat} in WhatsApp",
  "deleteGuide.theChat": "the chat",
  "deleteGuide.body":
    "Your archive is written and encrypted on this phone. Deleting the chat is something only you can do — {app} has no way to reach into WhatsApp, and neither does any other app.",
  "deleteGuide.before.title": "Before you do",
  "deleteGuide.before.body":
    "Go back one screen and read the numbers again. Once the chat is gone, anything the archive did not capture is gone with it.",
  "deleteGuide.before.cta": "Back to what was captured",
  "deleteGuide.steps.ios": "In WhatsApp, on iPhone",
  "deleteGuide.steps.android": "In WhatsApp, on Android",
  "deleteGuide.ios.1": "Open WhatsApp and find the chat in your Chats list.",
  "deleteGuide.ios.2": "Swipe left on it, then tap More.",
  "deleteGuide.ios.3": "Tap Delete Chat, and confirm.",
  "deleteGuide.ios.4": "To reclaim the space now: Settings → Storage and Data → Manage Storage.",
  "deleteGuide.android.1": "Open WhatsApp and find the chat in your Chats list.",
  "deleteGuide.android.2": "Press and hold the chat until it is selected.",
  "deleteGuide.android.3": "Tap the bin icon at the top, and confirm.",
  "deleteGuide.android.4": "To reclaim the space now: Settings → Storage and data → Manage storage.",
  "deleteGuide.clear.title": "What “Clear chat” does instead",
  "deleteGuide.clear.body":
    "Clearing empties the messages but keeps the chat in your list. Deleting removes both. Either one frees the space the media was using; neither can be undone from inside WhatsApp.",
  "deleteGuide.confirm": "I have deleted this chat in WhatsApp",
  "deleteGuide.confirmed":
    "Noted on this phone only — we have no way to check, and we do not try. Your archive stays exactly as it is.",

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
  "reader.day.today": "Today",
  "reader.day.yesterday": "Yesterday",

  // ── Message bubbles ─────────────────────────────────────────────────────────────────────
  "bubble.notInExport": "This file was named in the chat but was not in the export.",
  "bubble.omitted": "WhatsApp left this media out of the export — it is not in the archive.",
  "bubble.deleted": "This message was deleted",
  "bubble.decryptFailed": "This image did not decrypt: {error}",
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
  "chatPhoto.hint": "WhatsApp exports don't include the chat's photo. Open any photo below to use it.",
  "info.locked": "This archive is locked. Open it from the library and enter your passphrase.",
  "info.error.heading": "Could not read this archive",
  "info.media.title": "Media ({count})",
  "info.media.seeAll": "See all",
  "info.media.facts": "{files} · {size}",
  "info.media.notPlayable": "{count} video or audio, archived but not playable here",
  "info.people.one": "{count} participant",
  "info.people.other": "{count} participants",
  "info.people.hint":
    "Tap whoever you are and your messages move to the right, like they do in WhatsApp. An export never says which name is yours — every line looks the same from outside.",
  "info.people.alsoSeenAs": "also seen as {names}",
  "info.people.you": "You",
  "info.sources.one": "Built from {count} export",
  "info.sources.other": "Built from {count} exports",
  "info.sources.hint":
    "Every export anyone shares in is merged, never duplicated. Someone else's copy of this chat can reach further back than yours, and adding it only ever grows the archive.",
  "info.sources.thisPhone": "This phone",
  "info.sources.platform": "{contributor} · {platform} export",
  "info.saved.title": "Where this is saved",
  "info.saved.noAccount":
    "Nothing is ever sent to our servers. The archive is encrypted before it is written, so the files give nothing away without your passphrase — on this phone and in your Google Drive alike.",
  "info.saved.backup":
    "It is included in your iPhone backup, which is what lets it survive a lost phone. The key is not: the Keychain entry stays on this device, so after restoring to a new phone the archive opens with your passphrase, and only with your passphrase.",
  "info.archive.title": "Archive",
  "info.archive.created": "Created",
  "info.archive.updated": "Last updated",
  "info.archive.chunks": "Chunks",
  "info.archive.format": "Format version",
  "info.danger.title": "Remove from this phone",

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
    "This archive does not open, so there is nothing in it to lose by removing it. Its folder and its key are deleted from this phone.",
  "remove.locked.body":
    "This archive is locked and this phone does not hold its key. If you still know the passphrase, unlocking it is worth trying before removing it — once it is gone from this phone, the only copy left is one in your Google Drive, if you backed it up.",
  "remove.ready.body":
    "This deletes {messages} and {files} from this phone, and it cannot be undone. A copy in your own Google Drive, if you backed this chat up, is not touched. Otherwise — if you have already deleted this chat in WhatsApp — this is the only copy that exists.",
  "remove.ready.confirm": "I understand this is permanent on this phone",
  "remove.cta": "Remove from this phone",
  "remove.working": "Removing...",
  "remove.failed": "Could not remove this archive: {error}",
  "remove.noteWhatsApp":
    "This removes the archive only. It changes nothing in WhatsApp — this app never touches it.",

  // ── Device checks (dev-only) ────────────────────────────────────────────────────────────
  "dev.title": "Storage contract",
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
  "common.delete": "מחיקה",
  "common.remove": "הסרה",
  "common.showFewer": "הצגה מצומצמת",
  "common.showAll": "הצגת כל ה־{count}",
  "common.viewAll": "הצגת כל ה־{count}",
  "common.unknown": "לא ידוע",
  "common.messages.one": "הודעה אחת",
  "common.messages.other": "{count} הודעות",
  "common.files.one": "קובץ אחד",
  "common.files.other": "{count} קבצים",
  "common.people.one": "משתתף אחד",
  "common.people.other": "{count} משתתפים",
  "common.archives.one": "ארכיון אחד",
  "common.archives.other": "{count} ארכיונים",
  "common.and": "ו",
  "common.andOthers": "{names} ועוד {count}",
  "common.noOne": "אף אחד",

  // ── Library ─────────────────────────────────────────────────────────────────────────────
  "library.title": "צ׳אטים",
  "library.hero.line":
    "של מדיה, שמורים ב{archives} שלכם — מוצפנים בטלפון הזה, במקום שבחרתם.",
  "library.heading.one": "ארכיון אחד",
  "library.heading.other": "{count} ארכיונים",
  "library.addMore":
    "כדי להוסיף לארכיון קיים — או לפתוח חדש — ייצאו צ׳אט בוואטסאפ ושתפו אותו לכאן. ייצוא של צ׳אט שכבר בארכיון ימוזג פנימה, בלי כפילויות.",
  "library.holdToManage": "לחיצה ארוכה על צ׳אט מסירה אותו מהטלפון הזה.",
  "library.storage.title": "איפה זה נשמר",
  "library.storage.more":
    "פתחו צ׳אט והקישו על ״מידע״ לתמונה המלאה, כולל מה קורה לארכיון שלכם כשאתם מגבים או מחליפים טלפון.",
  "library.card.locked.title": "ארכיון נעול",
  "library.card.locked.body":
    "המפתח לארכיון הזה לא נמצא בטלפון — אחרי שחזור מגיבוי או התקנה מחדש זה מצב רגיל. פתחו אותו והזינו את סיסמת המעבר.",
  "library.card.unreadable.title": "הארכיון הזה לא נפתח",
  "library.card.unreadable.warning": "אם עוד לא מחקתם את הצ׳אט הזה בוואטסאפ — אל תמחקו.",
  "library.card.imports": "{count} ייבואים",
  "library.empty.heading": "עדיין אין ארכיונים",
  "library.empty.body":
    "בוואטסאפ, פתחו צ׳אט, הקישו על שם הצ׳אט ובחרו ״ייצוא צ׳אט״. אחר כך בחרו את {app} מתפריט השיתוף.",
  "library.empty.cta": "איך מייצאים צ׳אט",
  "library.dev": "פיתוח: הרצת בדיקות המכשיר",

  // ── Add tab ─────────────────────────────────────────────────────────────────────────────
  "add.title": "הוספת צ׳אט",
  "add.lede":
    "ל{app} אין שום דרך להיכנס לוואטסאפ, ולכן צ׳אט מגיע לכאן בדרך אחת: אתם מייצאים אותו ומשתפים לכאן. זה לוקח בערך דקה.",
  "add.steps.title": "בוואטסאפ",
  "add.step.1": "פתחו את הצ׳אט שאתם רוצים לשמור.",
  "add.step.2": "הקישו על שם הצ׳אט למעלה כדי לפתוח את מסך המידע שלו.",
  "add.step.3": "גללו למטה והקישו על ״ייצוא צ׳אט״.",
  "add.step.4": "בחרו ״צרף מדיה״ — בלי זה תקבלו את הטקסט ואף לא תמונה אחת.",
  "add.step.5": "בתפריט השיתוף שנפתח, בחרו את {app}.",
  "add.waiting.title": "ואז חזרו לכאן",
  "add.waiting.body":
    "מסך הייבוא נפתח מעצמו ברגע שהייצוא מגיע. הפענוח, ההצפנה והכתיבה קורים כולם בטלפון הזה, ושום דבר לא נשלח לשרתים שלנו.",
  "add.limits.title": "שני דברים שכדאי לדעת מראש",
  "add.limits.cap":
    "וואטסאפ מגבילה ייצוא לכ־40,000 הודעות, או 10,000 אם צירפתם מדיה, לאחור מההודעה האחרונה. ארכוב נוסף בהמשך ימשיך מהמקום שבו הייצוא הזה נעצר — וכך גם כל אחד אחר בקבוצה שמארכב את העותק שלו.",
  "add.limits.noDelete":
    "{app} לא יכולה למחוק שום דבר מוואטסאפ; שום אפליקציה לא יכולה. אחרי שהארכיון נשמר ואומת, נראה לכם איך למחוק את הצ׳אט בעצמכם.",
  "add.merge.title": "לשתף את אותו צ׳אט פעמיים זה בטוח",
  "add.merge.body":
    "ייצוא של צ׳אט שכבר מארכב ימוזג פנימה, לעולם לא ייכפל — ייבוא של אותו קובץ פעמיים לא משנה כלום. בדיוק זה מה שמאפשר לכמה אנשים בקבוצה לתרום כל אחד את העותק שלו.",

  // ── Account tab ─────────────────────────────────────────────────────────────────────────
  "account.title": "חשבון",
  "account.none.title": "אין לכם, ולא צריך",
  "account.none.body":
    "ל{app} עדיין אין הרשמה, ושום דבר שאתם מארכבים לא נשלח אף פעם לשרתים שלנו. הארכיונים מוצפנים בטלפון הזה בסיסמת מעבר שרק אתם מחזיקים — ואם תחברו את Google Drive, אותם קבצים מוצפנים יועתקו ל-Drive שלכם, לא שלנו.",
  "account.why.title": "אז בשביל מה בכלל חשבון?",
  "account.why.body":
    "בשביל דבר אחד: לשמור ארכיונים במקום נוסף מלבד הטלפון הזה. גוגל דרייב, אייקלאוד, או קישור שאתם שולחים למישהו אחר בצ׳אט — לכל אחד מהם צריך להתחבר איפשהו, ורק אז מתחיל להיות חשבון.",
  "account.why.promise":
    "זה לא ישנה איפה מתבצעת ההצפנה. המפתח נגזר במכשיר שלכם, והשרת בנוי כך שאינו יכול להחזיק מפתח — קישור שיתוף נושא את המפתח בחלק של הכתובת שדפדפן לעולם לא שולח.",
  "backup.section": "עותק ב-Google Drive",
  "backup.notConnected":
    "נמצא רק בטלפון הזה. חברו את Google Drive בלשונית החשבון כדי לשמור עותק מוצפן ב-Drive שלכם.",
  "backup.running": "מגבה ל-Google Drive שלכם…",
  "backup.progress": "{done} מתוך {total}",
  "backup.done": "מגובה ב-Google Drive שלכם · {when}",
  "backup.never": "עדיין לא נמצא ב-Google Drive שלכם.",
  "backup.now": "גיבוי עכשיו",
  "backup.retry": "ניסיון נוסף",
  "backup.diverged":
    "העותק ב-Drive שלכם שונה מטלפון אחר מאז שהטלפון הזה גיבה אותו לאחרונה, ולכן הוא נשאר כמו שהוא.",
  "backup.failed": "הגיבוי לא הושלם ({message}). ניסיון נוסף ימשיך מהמקום שבו נעצר.",
  "account.drive.title": "Google Drive",
  "account.drive.body":
    "חברו את חשבון הגוגל שלכם ו{app} תוכל לשמור את הצ׳אטים ב-Drive שלכם, בתיקייה בשם {app}. היא רואה רק את הקבצים שהיא יצרה — שום דבר אחר ב-Drive — ושום דבר לא עובר דרך השרתים שלנו.",
  "account.drive.connect": "חיבור Google Drive",
  "account.drive.connected": "מחובר בתור {email}",
  "account.drive.noScope":
    "נכנסתם, אבל לא אישרתם גישה ל-Drive. התחברו שוב וסמנו את Google Drive במסך של גוגל.",
  "account.drive.disconnect": "ניתוק",
  "account.drive.next": "צ׳אטים חדשים מגובים ל-Drive שלכם מיד אחרי הייבוא.",
  "account.drive.backupAll": "גיבוי כל הצ׳אטים עכשיו",
  "account.drive.backupAllDone": "{ok} גובו",
  "account.drive.backupAllFailed": "{ok} גובו, {failed} לא — פתחו צ׳אט כדי לראות למה",
  "account.drive.restoreFound": "ב-Drive שלכם אבל לא בטלפון הזה: {count}",
  "account.drive.restoreNone": "כל הצ׳אטים ב-Drive שלכם כבר נמצאים בטלפון הזה.",
  "account.drive.restore": "הורדה",
  "account.drive.restoring": "מוריד {n} מתוך {count}…",
  "account.drive.restored": "הורד. הצ׳אטים נמצאים ברשימה, נעולים — פתחו כל אחד עם סיסמת המעבר שלו.",
  "account.drive.error": "החיבור נכשל: {message}",
  "account.status.drive": "Google Drive",
  "account.status.driveNone": "לא מחובר",
  "account.status.title": "נכון להיום",
  "account.status.storage": "אחסון",
  "account.status.storageValue": "הטלפון הזה בלבד",
  "account.status.storageDrive": "הטלפון הזה וה-Google Drive שלכם",
  "account.status.uploaded": "נשלח לשרתים שלנו",
  "account.status.uploadedValue": "כלום, אף פעם",
  "account.status.signedIn": "מחוברים בתור",
  "account.status.signedInValue": "אף אחד",
  "account.status.archives": "ארכיונים בטלפון הזה",
  "account.footnote":
    "ב-Drive שלכם נמצאים אותם קבצים מוצפנים כמו בטלפון הזה. מי שיפתח אותם שם — כולל גוגל — לא יראה כלום בלי סיסמת המעבר שלכם.",

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
  "settings.appearance.systemNote": "״אוטומטי״ הולך לפי הגדרת המצב הבהיר או הכהה של הטלפון.",
  "settings.storage.title": "אחסון",
  "settings.storage.archives": "ארכיונים בטלפון הזה",
  "settings.storage.media": "מדיה שמורה",
  "settings.about.title": "אודות",
  "settings.about.version": "גרסה",
  "settings.about.format": "פורמט הארכיון",
  "settings.about.body":
    "{app} הופכת ייצוא מוואטסאפ לארכיון מוצפן שהוא שלכם, ואז מראה לכם איך למחוק את המקור בעצמכם. היא לא יכולה למחוק שום דבר מוואטסאפ, והיא אף פעם לא שולחת את הצ׳אטים שלכם לשרתים שלנו — העותק היחיד מחוץ לטלפון הוא זה שתבחרו לשמור ב-Google Drive שלכם.",
  "settings.dev.title": "פיתוח",
  "settings.dev.checks": "הרצת בדיקות המכשיר",
  "settings.dev.checksNote":
    "חוזה האחסון וצינור ההצפנה, רצים בתוך סביבת הריצה הזו. בגרסאות פיתוח בלבד.",

  // ── Import ──────────────────────────────────────────────────────────────────────────────
  "import.title": "ייבוא",
  "import.reading": "קוראים את הייצוא...",
  "import.stage.deriving-key": "גוזרים את המפתח מסיסמת המעבר...",
  "import.stage.parsing": "קוראים את ההודעות...",
  "import.stage.checking-media": "בודקים את קובצי המדיה...",
  "import.stage.writing": "מצפינים וכותבים...",
  "import.stage.verifying": "קוראים את הארכיון בחזרה כדי לבדוק אותו...",
  "import.note.counts": "{messages}, {size} של ייצוא.",
  "import.note.writing": "מצפינים כל קובץ בטלפון הזה — ייצוא גדול יכול לקחת זמן.",
  "import.note.deriving": "איטי בכוונה, כדי שלא יהיה אפשר לנחש ארכיון גנוב. לוקח רגע.",
  "import.note.local": "הכול קורה כאן; שום דבר לא נשלח לשרתים שלנו.",
  "import.onThisPhone": "הכול קורה בטלפון הזה. שום דבר לא נשלח לשרתים שלנו.",
  "import.choose.heading": "בחרו סיסמת מעבר",
  "import.unlock.heading": "פתיחת {chat}",
  "import.choose.body":
    "הארכיון הזה מוצפן בטלפון הזה לפני שהוא נכתב. סיסמת המעבר היא הדרך היחידה חזרה אליו — מהטלפון הזה, מטלפון חדש, או מהצפיין באינטרנט.",
  "import.unlock.body":
    "הייצוא הזה שייך לארכיון שכבר נמצא בטלפון, אבל המפתח שלו לא נמצא במחזיק המפתחות של הטלפון. סיסמת המעבר שלכם פותחת אותו.",
  "import.choose.warning":
    "אנחנו לא יכולים לאפס אותה ולא יכולים לשחזר אותה. לאף אחד אין עותק — וזה בדיוק מה שהופך את הארכיון לשלכם. רשמו אותה במקום בטוח לפני שתמשיכו.",
  "import.field.passphrase": "סיסמת מעבר",
  "import.field.placeholder": "לפחות 8 תווים",
  "import.field.again": "הקלידו שוב",
  "import.field.confirm": "אישור סיסמת המעבר",
  "import.field.mismatch": "השתיים לא זהות.",
  "import.field.tooShort":
    "השתמשו ב־8 תווים לפחות. סיסמת המעבר הזו היא הדרך היחידה חזרה אל הארכיון.",
  "import.summary.chat": "צ׳אט",
  "import.summary.inExport": "בייצוא הזה",
  "import.summary.file": "קובץ",
  "import.summary.alreadyArchived": "כבר בארכיון",
  "import.summary.alreadyArchivedValue": "{count} מתוכן",
  "import.submit.create": "יצירת הארכיון",
  "import.submit.merge": "פתיחה ומיזוג",
  "import.error.wrongPassphrase": "סיסמת המעבר הזו לא פותחת את הארכיון.",
  "import.error.unfinished": "הייבוא לא הסתיים.",
  "import.error.unreadable": "לא הצלחנו לקרוא את הייצוא הזה.",
  "import.error.noFile": "לא הגיע שום קובץ עם השיתוף.",
  "import.error.reassurance":
    "שום דבר לא השתנה בוואטסאפ. הצ׳אט שלכם בדיוק במקום שבו היה — האפליקציה הזו לא נוגעת בו לעולם.",

  // ── Verify ──────────────────────────────────────────────────────────────────────────────
  "verify.title": "מה נשמר",
  "verify.nothing.heading": "אין מה לאמת",
  "verify.nothing.body":
    "המסך הזה מראה מה נשמר בייבוא, מיד אחרי שהוא קורה. פתחו ארכיון מהספרייה כדי לראות מה יש בו עכשיו.",
  "verify.eyebrow.created": "הארכיון נוצר",
  "verify.eyebrow.merged": "מוזג לארכיון שלכם",
  "verify.lede.created": "{messages} מוצפנות עכשיו בטלפון הזה.",
  "verify.lede.added": "נוספו {added} הודעות חדשות — {total} בארכיון עכשיו.",
  "verify.lede.nothingNew":
    "אין שום דבר חדש בייצוא הזה. כל {total} ההודעות האלה כבר היו בארכיון.",
  "verify.holds": "מה יש בארכיון",
  "verify.row.messages": "הודעות",
  "verify.row.dateRange": "טווח תאריכים",
  "verify.row.people": "משתתפים",
  "verify.row.peopleCount": "משתתפים ({count})",
  "verify.row.mediaFiles": "קובצי מדיה",
  "verify.row.mediaSize": "נפח מדיה",
  "verify.row.dedup": "נחסך בזכות איחוד כפילויות",
  "verify.nextSteps": "מה עוד אפשר לעשות",
  "verify.issues.title": "שורות שהמפענח לא הצליח לקרוא",
  "verify.issues.body":
    "{count} כאלה. הן נשמרו כטקסט ולא הושמטו, אבל אם המספר הזה גדול ייתכן שהארכיון לא תואם למה שאתם רואים בוואטסאפ — כדאי לבדוק לפני שאתם מוחקים משהו.",
  "verify.check.title": "בדקו בעצמכם",
  "verify.check.body":
    "פתחו את הצ׳אט בוואטסאפ והשוו. מספר ההודעות והתאריכים למעלה אמורים להתאים למה שיש שם. אם לא — אל תמחקו את הצ׳אט, ספרו לנו במקום.",
  "verify.cta.read": "קריאת הארכיון",
  "verify.cta.delete": "עכשיו מוחקים את הצ׳אט בוואטסאפ",
  "verify.footnote":
    "{app} לא יכולה למחוק שום דבר מוואטסאפ — שום אפליקציה לא יכולה. המסך הבא מראה לכם איך לעשות את זה בעצמכם, כשתהיו שלמים עם מה שלמעלה.",

  // ── Guided delete ───────────────────────────────────────────────────────────────────────
  "deleteGuide.title": "מחיקה בוואטסאפ",
  "deleteGuide.heading": "מחיקת {chat} בוואטסאפ",
  "deleteGuide.theChat": "הצ׳אט",
  "deleteGuide.body":
    "הארכיון שלכם נכתב והוצפן בטלפון הזה. מחיקת הצ׳אט היא דבר שרק אתם יכולים לעשות — ל{app} אין שום דרך להיכנס לוואטסאפ, וגם לא לאף אפליקציה אחרת.",
  "deleteGuide.before.title": "לפני שאתם מוחקים",
  "deleteGuide.before.body":
    "חזרו מסך אחד אחורה וקראו את המספרים שוב. ברגע שהצ׳אט נעלם, כל מה שהארכיון לא תפס נעלם איתו.",
  "deleteGuide.before.cta": "חזרה למה שנשמר",
  "deleteGuide.steps.ios": "בוואטסאפ, באייפון",
  "deleteGuide.steps.android": "בוואטסאפ, באנדרואיד",
  "deleteGuide.ios.1": "פתחו את וואטסאפ ומצאו את הצ׳אט ברשימת הצ׳אטים.",
  "deleteGuide.ios.2": "החליקו עליו שמאלה והקישו על ״עוד״.",
  "deleteGuide.ios.3": "הקישו על ״מחק צ׳אט״ ואשרו.",
  "deleteGuide.ios.4": "כדי לפנות את המקום עכשיו: הגדרות ← אחסון ונתונים ← ניהול אחסון.",
  "deleteGuide.android.1": "פתחו את וואטסאפ ומצאו את הצ׳אט ברשימת הצ׳אטים.",
  "deleteGuide.android.2": "לחצו לחיצה ארוכה על הצ׳אט עד שהוא נבחר.",
  "deleteGuide.android.3": "הקישו על סמל הפח למעלה ואשרו.",
  "deleteGuide.android.4": "כדי לפנות את המקום עכשיו: הגדרות ← אחסון ונתונים ← ניהול אחסון.",
  "deleteGuide.clear.title": "מה ״ניקוי צ׳אט״ עושה במקום",
  "deleteGuide.clear.body":
    "ניקוי מרוקן את ההודעות אבל משאיר את הצ׳אט ברשימה. מחיקה מסירה את שניהם. שתי הפעולות מפנות את המקום שהמדיה תפסה; אף אחת מהן לא ניתנת לביטול מתוך וואטסאפ.",
  "deleteGuide.confirm": "מחקתי את הצ׳אט הזה בוואטסאפ",
  "deleteGuide.confirmed":
    "נרשם בטלפון הזה בלבד — אין לנו שום דרך לבדוק, ואנחנו גם לא מנסים. הארכיון שלכם נשאר בדיוק כפי שהוא.",

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
  "reader.day.today": "היום",
  "reader.day.yesterday": "אתמול",

  // ── Message bubbles ─────────────────────────────────────────────────────────────────────
  "bubble.notInExport": "הקובץ הזה הוזכר בצ׳אט אבל לא נכלל בייצוא.",
  "bubble.omitted": "וואטסאפ השאירה את המדיה הזו מחוץ לייצוא — היא לא נמצאת בארכיון.",
  "bubble.deleted": "ההודעה הזו נמחקה",
  "bubble.decryptFailed": "התמונה הזו לא פוענחה: {error}",
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
  "chatPhoto.hint": "ייצוא מוואטסאפ לא כולל את תמונת הצ׳אט. פתחו כל תמונה למטה כדי להשתמש בה.",
  "info.locked": "הארכיון הזה נעול. פתחו אותו מהספרייה והזינו את סיסמת המעבר.",
  "info.error.heading": "לא הצלחנו לקרוא את הארכיון הזה",
  "info.media.title": "מדיה ({count})",
  "info.media.seeAll": "הצגת הכול",
  "info.media.facts": "{files} · {size}",
  "info.media.notPlayable": "{count} וידאו או אודיו, שמורים בארכיון אך לא ניתנים לנגינה כאן",
  "info.people.one": "משתתף אחד",
  "info.people.other": "{count} משתתפים",
  "info.people.hint":
    "הקישו על עצמכם וההודעות שלכם יעברו לצד השני, בדיוק כמו בוואטסאפ. ייצוא אף פעם לא אומר איזה שם הוא שלכם — מבחוץ כל השורות נראות אותו דבר.",
  "info.people.alsoSeenAs": "מופיע גם בשם {names}",
  "info.people.you": "אתם",
  "info.sources.one": "נבנה מייצוא אחד",
  "info.sources.other": "נבנה מ־{count} ייצואים",
  "info.sources.hint":
    "כל ייצוא שמישהו משתף פנימה ממוזג, לעולם לא נכפל. העותק של מישהו אחר מהצ׳אט הזה יכול להגיע רחוק יותר אחורה משלכם, והוספתו רק מגדילה את הארכיון.",
  "info.sources.thisPhone": "הטלפון הזה",
  "info.sources.platform": "{contributor} · ייצוא מ־{platform}",
  "info.saved.title": "איפה זה נשמר",
  "info.saved.noAccount":
    "שום דבר לא נשלח אף פעם לשרתים שלנו. הארכיון מוצפן לפני שהוא נכתב, כך שהקבצים לא מסגירים דבר בלי סיסמת המעבר שלכם — בטלפון הזה וב-Google Drive שלכם כאחד.",
  "info.saved.backup":
    "הוא כלול בגיבוי של האייפון, וזה מה שמאפשר לו לשרוד טלפון אבוד. המפתח לא: הרשומה במחזיק המפתחות נשארת במכשיר הזה, ולכן אחרי שחזור לטלפון חדש הארכיון נפתח עם סיסמת המעבר שלכם, ורק איתה.",
  "info.archive.title": "ארכיון",
  "info.archive.created": "נוצר",
  "info.archive.updated": "עודכן לאחרונה",
  "info.archive.chunks": "מקטעים",
  "info.archive.format": "גרסת פורמט",
  "info.danger.title": "הסרה מהטלפון הזה",

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
    "הארכיון הזה לא נפתח, ולכן אין בו שום דבר להפסיד בהסרה. התיקייה שלו והמפתח שלו יימחקו מהטלפון הזה.",
  "remove.locked.body":
    "הארכיון הזה נעול והטלפון הזה לא מחזיק את המפתח שלו. אם אתם עדיין זוכרים את סיסמת המעבר, כדאי לנסות לפתוח אותו לפני שמסירים — ברגע שהוא נעלם מהטלפון הזה, העותק היחיד שנשאר הוא זה שב-Google Drive שלכם, אם גיביתם אותו.",
  "remove.ready.body":
    "הפעולה הזו מוחקת {messages} ו{files} מהטלפון הזה, ואין דרך לבטל אותה. עותק ב-Google Drive שלכם, אם גיביתם את הצ׳אט, לא נפגע. אחרת — אם כבר מחקתם את הצ׳אט בוואטסאפ — זה העותק היחיד שקיים.",
  "remove.ready.confirm": "אני מבין שזה לצמיתות בטלפון הזה",
  "remove.cta": "הסרה מהטלפון הזה",
  "remove.working": "מסירים...",
  "remove.failed": "לא הצלחנו להסיר את הארכיון הזה: {error}",
  "remove.noteWhatsApp":
    "זה מסיר את הארכיון בלבד. זה לא משנה שום דבר בוואטסאפ — האפליקציה הזו לא נוגעת בה לעולם.",

  // ── Device checks (dev-only) ────────────────────────────────────────────────────────────
  "dev.title": "חוזה האחסון",
};

export const catalogue = { en, he } as const;
