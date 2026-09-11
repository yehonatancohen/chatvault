/**
 * Landing. Short on purpose (owner's rule: minimal text): what Boydem is, and the two ways in —
 * your own chats from Google Drive (`/chats`), or a chat file someone gave you (`/open`).
 *
 * Set in Hebrew, RTL. Invariant 1 (root CLAUDE.md): Boydem never deletes from WhatsApp and never
 * says it frees storage; it shows the reader how to delete the original themselves.
 */
export default function HomePage() {
  return (
    <main className="landing" dir="rtl" lang="he">
      <div className="landing-brand">
        <img src="/icon-boydem.svg" alt="" />
        <span>בוידעם</span>
      </div>

      <h1>הצ׳אטים של וואטסאפ, שמורים אצלכם.</h1>

      <p className="landing-lead">
        שומרים צ׳אט באפליקציה, והוא מגובה ל־Google Drive שלכם. כאן אפשר לקרוא אותו מכל מחשב.
      </p>

      <a className="landing-cta" href="/chats">
        הצ׳אטים שלי
      </a>

      <p className="landing-note">
        <a href="/open">פתיחת קובץ צ׳אט</a> · שום דבר לא נשלח לשרתים שלנו.
      </p>

      <p className="landing-en">
        Boydem — your WhatsApp chats, kept in your own Google Drive. <a href="/chats">Open my chats →</a>
      </p>
    </main>
  );
}
