import type { Metadata } from "next";

/**
 * The privacy policy. It only describes what this site and the Boydem app actually do — the
 * facts here are the same invariants the rest of the codebase is held to (root `CLAUDE.md`):
 * chats are parsed on the device, never uploaded to Boydem's servers, and stored only on the
 * phone and in storage the user owns. Nothing here should ever say more than the code does.
 */
export const metadata: Metadata = {
  title: "פרטיות — בוידעם",
  description: "מה בוידעם אוסף, מה הוא לא אוסף, ולאן הצ׳אטים שלכם הולכים.",
};

export default function PrivacyPage() {
  return (
    <div className="legal">
      <PageHeader />
      <main className="wrap-narrow legal-main">
        <h1>מדיניות פרטיות</h1>
        <p className="legal-updated">עודכן לאחרונה: 26 בספטמבר 2026</p>

        <section>
          <h2>העיקרון</h2>
          <p>
            בוידעם קורא את קובץ הייצוא של וואטסאפ <strong>על המכשיר שלכם</strong>. הצ׳אט עצמו —
            הודעות, תמונות, סרטונים — לא מגיע לשרתים שלנו בשום שלב, לא בגלוי ולא מוצפן. הוא נשמר
            רק בטלפון וב-Google Drive (או שירות אחסון אחר שתבחרו) שאתם הבעלים שלו.
          </p>
        </section>

        <section>
          <h2>מה נשמר אצלנו</h2>
          <p>
            השרתים שלנו לא מחזיקים תוכן צ׳אטים ולא מחזיקים מפתחות הצפנה. מה שכן נשמר, כשיש לכם
            חשבון באפליקציה: פרטי החשבון, מצב המנוי, ורשומות שיתוף (איזה צ׳אט שותף עם מי — לא
            תוכן הצ׳אט). זה נכון גם לצ׳אטים "רגילים" וגם לצ׳אטים המוגנים בסיסמה.
          </p>
        </section>

        <section>
          <h2>הגנה בסיסמה — אופציונלית</h2>
          <p>
            כברירת מחדל צ׳אט נשמר כקובץ קריא, גם בטלפון וגם ב-Drive. אתם יכולים לבחור להגן על
            צ׳אט בסיסמה — או אז הוא מוצפן מקצה לקצה, ורק מי שיש לו את הסיסמה יכול לפתוח אותו.
            הסיסמה לא נשלחת אלינו ולא נשמרת אצלנו; אם היא הולכת לאיבוד, אין לנו דרך לשחזר אותה.
          </p>
        </section>

        <section>
          <h2>האתר הזה</h2>
          <p>לאתר עצמו אין הרשמה, אין חשבון ואין עוגיות מעקב. שני דברים שהוא כן עושה:</p>
          <ul>
            <li>
              <strong>פתיחת צ׳אט ששותף בקישור</strong> — הדפדפן שלכם מוריד את הקבצים ישירות
              מ-Google Drive של מי ששיתף, בעזרת מפתח API ציבורי שמוגבל לקריאה של מה ששותף
              "לכל מי שיש את הקישור" בלבד. השרתים שלנו לא נוגעים בבקשה הזו.
            </li>
            <li>
              <strong>״שמירה אצלי״</strong> — אם תבחרו לשמור עותק של צ׳אט ששותף איתכם, האתר מבקש
              הרשאת גישה חד-פעמית ל-Google Drive שלכם (לא התחברות לבוידעם, אין חשבון ואין
              קוקי) והעותק עובר מה-Drive של הבעלים אל הדפדפן שלכם אל ה-Drive שלכם — בלי לעבור
              דרכנו.
            </li>
          </ul>
          <p>
            צ׳אט מוגן שנפתח כך נשאר מוצפן: המפתח שלו נוסע רק בחלק הכתובת שהדפדפן לא שולח לאף
            שרת ({"#"}), ולא בגוף הבקשה או ב-Referer. באתר אין סקריפטים של גורמים חיצוניים
            (אנליטיקס, פרסום) שיכולים לקרוא את הכתובת הזו.
          </p>
        </section>

        <section>
          <h2>מחיקה מוואטסאפ</h2>
          <p>
            בוידעם לא מוחק ולא יכול למחוק הודעות מוואטסאפ — אין לזה API. האפליקציה שומרת את
            הצ׳אט ואז מדריכה אתכם איך למחוק אותו בעצמכם בוואטסאפ, אם תרצו.
          </p>
        </section>

        <section>
          <h2>שאלות</h2>
          <p>
            לשאלות על פרטיות אפשר לכתוב אלינו ב<a href="/support">עמוד התמיכה</a>.
          </p>
        </section>
      </main>
      <PageFooter />
    </div>
  );
}

function PageHeader() {
  return (
    <header className="legal-nav">
      <div className="wrap-narrow legal-nav-inner">
        <a className="brand" href="/" aria-label="בוידעם">
          <img src="/icon-boydem.svg" alt="" width={36} height={36} />
          <span>בוידעם</span>
        </a>
      </div>
    </header>
  );
}

function PageFooter() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <span className="footer-brand">בוידעם</span>
        <nav className="footer-links" aria-label="ניווט">
          <a href="/">בית</a>
          <a href="/privacy">פרטיות</a>
          <a href="/support">תמיכה</a>
        </nav>
      </div>
    </footer>
  );
}
