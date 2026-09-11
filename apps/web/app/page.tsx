import { GetTheApp } from "./_components/GetTheApp";

/**
 * The home page: what Boydem is, why, and what it costs — and every path leads to the app.
 *
 * The website has exactly two jobs (owner, 2026-09-11): this page, and showing a chat someone
 * shared (`/s/<id>`). No sign-in, no accounts, no tools — saving chats happens in the app.
 *
 * Hebrew, RTL. Copy rules still apply: Boydem never deletes from WhatsApp and never says it frees
 * storage itself (invariant 1); chats never go to our servers (invariant 2).
 */
export default function HomePage() {
  return (
    <main className="home" dir="rtl" lang="he">
      <section className="home-hero">
        <div className="landing-brand">
          <img src="/icon-boydem.svg" alt="" />
          <span>בוידעם</span>
        </div>
        <h1>הטלפון מלא בגלל וואטסאפ?</h1>
        <p className="home-lead">
          בוידעם שומר את הצ׳אטים שלכם — עם כל התמונות — ב־Google Drive שלכם. אחר כך אפשר למחוק אותם
          מוואטסאפ בראש שקט, ולקרוא אותם מתי שרוצים.
        </p>
        <GetTheApp />
      </section>

      <section className="home-section">
        <h2>איך זה עובד</h2>
        <ol className="home-steps">
          <li>
            <strong>מייצאים צ׳אט</strong> מוואטסאפ ומשתפים אותו לבוידעם.
          </li>
          <li>
            <strong>בוידעם שומר אותו</strong> ומגבה אותו ל־Google Drive שלכם.
          </li>
          <li>
            <strong>מוחקים את הצ׳אט בוואטסאפ</strong> בעצמכם, ומפנים מקום בטלפון.
          </li>
        </ol>
      </section>

      <section className="home-section home-points">
        <div>
          <h3>מקום בטלפון</h3>
          <p>התמונות עוברות ל־Drive. בטלפון נשארות רק ההודעות ותצוגה מקדימה קטנה.</p>
        </div>
        <div>
          <h3>שלכם</h3>
          <p>הצ׳אטים נשמרים ב־Drive שלכם, כקבצים רגילים. לא אצלנו — אף פעם.</p>
        </div>
        <div>
          <h3>לשתף צ׳אט</h3>
          <p>שולחים קישור, והצד השני קורא את הצ׳אט בדפדפן. בלי הרשמה.</p>
        </div>
      </section>

      <section className="home-section">
        <h2>מחירים</h2>
        <div className="home-prices">
          <div className="home-price">
            <div className="home-price-name">חינם</div>
            <div className="home-price-amount">₪0</div>
            <div className="home-price-note">עד 5 צ׳אטים</div>
          </div>
          <div className="home-price">
            <div className="home-price-name">רגיל</div>
            <div className="home-price-amount">₪10 לחודש</div>
            <div className="home-price-note">עד 20 צ׳אטים</div>
          </div>
          <div className="home-price">
            <div className="home-price-name">בלי הגבלה</div>
            <div className="home-price-amount">₪20 לחודש</div>
            <div className="home-price-note">כל הצ׳אטים</div>
          </div>
        </div>
      </section>

      <section className="home-section home-end">
        <GetTheApp />
        <p className="landing-en">Boydem — keep your WhatsApp chats in your own Google Drive.</p>
      </section>
    </main>
  );
}
