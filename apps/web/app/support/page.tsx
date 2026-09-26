import type { Metadata } from "next";

/** Support: how to reach us, and the questions that come up before that. */
export const metadata: Metadata = {
  title: "תמיכה — בוידעם",
  description: "יש בעיה או שאלה? כתבו לנו, או תבדקו אם התשובה כבר כאן.",
};

const SUPPORT_EMAIL = "yoncohenyon@gmail.com";

export default function SupportPage() {
  return (
    <div className="legal">
      <PageHeader />
      <main className="wrap-narrow legal-main">
        <h1>תמיכה</h1>
        <p className="lead">
          משהו לא עובד, או שיש לכם שאלה? כתבו לנו ל
          <a className="dialog-link" href={`mailto:${SUPPORT_EMAIL}`}>
            {" "}
            {SUPPORT_EMAIL}
          </a>
          . אנחנו קוראים כל הודעה.
        </p>

        <section>
          <h2>שאלות נפוצות</h2>
          <div className="faq">
          <details>
            <summary>בוידעם מוחק לי צ׳אטים מוואטסאפ?</summary>
            <p>לא, ואף אפליקציה לא יכולה. בוידעם שומר, ואז מראה לכם איך למחוק בעצמכם.</p>
          </details>
          <details>
            <summary>מי יכול לקרוא את הצ׳אטים?</summary>
            <p>
              הם נשמרים ב-Drive שלכם, לא אצלנו. מי שמחובר לחשבון הגוגל שלכם רואה אותם, כמו כל
              קובץ אחר שם. רוצים יותר? אפשר להגן על צ׳אט בסיסמה.
            </p>
          </details>
          <details>
            <summary>ומה אם הטלפון הולך לאיבוד?</summary>
            <p>מתקינים את בוידעם בטלפון החדש, מתחברים לאותו חשבון גוגל, והצ׳אטים חוזרים.</p>
          </details>
          <details>
            <summary>חלק מהתמונות לא נשמרו — למה?</summary>
            <p>
              וואטסאפ לא כולל בייצוא תמונות שכבר לא נמצאות בטלפון. זה רגיל, וההודעות עצמן כולן
              נשמרות.
            </p>
          </details>
          <details>
            <summary>שכחתי את הסיסמה של צ׳אט מוגן — מה עכשיו?</summary>
            <p>
              אין לנו דרך לשחזר סיסמה של צ׳אט מוגן — אנחנו לא מחזיקים אותה ולא את המפתח שלו.
              הבחירה בהגנת סיסמה שווה לזכור את הסיסמה, או לשמור אותה במקום בטוח.
            </p>
          </details>
          <details>
            <summary>קיבלתי קישור לצ׳אט ששותף איתי — זה בטוח?</summary>
            <p>
              כן. הדפדפן שלכם מוריד את הצ׳אט ישירות מה-Drive של מי ששיתף; דרכנו לא עובר כלום.
              פרטים ב<a href="/privacy">מדיניות הפרטיות</a>.
            </p>
          </details>
          </div>
        </section>

        <section>
          <h2>עדיין תקועים?</h2>
          <p>
            כתבו לנו ל
            <a className="dialog-link" href={`mailto:${SUPPORT_EMAIL}`}>
              {" "}
              {SUPPORT_EMAIL}
            </a>{" "}
            עם תיאור קצר של מה שקרה — ואם זה נוגע לצ׳אט מסוים, מתי ניסיתם ומה ראיתם על המסך.
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
