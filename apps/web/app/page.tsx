/**
 * Landing. Its whole job is to explain the trust model in plain language and hand the
 * visitor to `/open` — there is no share-link backend yet (B0b, Track C), so there is no
 * live countdown and no "save to Drive" here; both would be claims nothing backs.
 *
 * Set in Hebrew, RTL, matching the Boydem.dc.html direction. The RTL scope is this element,
 * not the document — the viewer at `/open` keeps its own per-message direction.
 *
 * Invariant 1 (root CLAUDE.md): Boydem never deletes from WhatsApp and never says it frees
 * storage. The copy guides the reader to delete the original themselves.
 */
export default function HomePage() {
  return (
    <main className="landing" dir="rtl" lang="he">
      <div className="landing-brand">
        <img src="/icon-boydem.svg" alt="" />
        <span>בוידעם</span>
      </div>

      <h1>הצ׳אטים של וואטסאפ, שמורים אצלך — ואפשר באמת לקרוא אותם.</h1>

      <p className="landing-lead">
        בוידעם לוקח ייצוא של צ׳אט מוואטסאפ, מצפין אותו על המכשיר שלך, ושומר אותו במקום שאתה
        בוחר. אחר כך הוא מראה לך, צעד־צעד, איך למחוק את הצ׳אט המקורי — את זה עושים רק אתם.
      </p>

      <div className="landing-card">
        <h2>מה עושים בעמוד הזה</h2>
        <p>
          פותחים ארכיון שמישהו שיתף אתכם, וגם מוסיפים את הייצוא שלכם מאותו צ׳אט — כך שההיסטוריה
          של הקבוצה חוזרת אחורה יותר ממה שייצוא אחד מסוגל לבד.
        </p>
      </div>

      <div className="landing-card">
        <h2>איך מגיע אליכם ארכיון</h2>
        <p>
          כרגע זה קובץ <code>.cvault</code> שמישהו מוסר לכם ישירות — ב־AirDrop, במייל או בתיקייה
          משותפת ב־Drive — יחד עם סיסמה. שום דבר שתפתחו לא נשלח לשום מקום: הפענוח קורה בלשונית
          הזו ולא באף מקום אחר.
        </p>
      </div>

      <a className="landing-cta" href="/open">
        פתח ארכיון
      </a>

      <p className="landing-note">
        מוצפן אצל השולח. המפתח יושב רק בקישור שקיבלתם — לא אצלנו. אנחנו לא רואים כלום.
      </p>

      <p className="landing-en">
        Boydem — a WhatsApp archive you own and can actually read. Open a shared{" "}
        <code>.cvault</code> file and a passphrase; it is decrypted only in this browser tab.{" "}
        <a href="/open">Open an archive →</a>
      </p>
    </main>
  );
}
