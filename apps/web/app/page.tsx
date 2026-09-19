import { GetTheApp } from "./_components/GetTheApp";

/**
 * The home page: what Boydem is, how it works, and what it costs — every path leads to the app.
 *
 * The website has exactly two jobs (owner, 2026-09-11): this page, and a chat someone shared
 * (`/s/<id>`). No sign-in, no tools. Hebrew, RTL.
 *
 * **The page is a public sign.** Ultramarine fields that run edge to edge, one solid pictogram
 * per idea, and numbers big enough to read from across the room — the same world as the app.
 * It opens by showing the product's one move (a chat leaving the phone for the attic, counted on
 * the way in), then WhatsApp's real steps as the same pictures the app's tutorial uses.
 *
 * Copy rules: Boydem never deletes from WhatsApp and never claims to free storage itself — the
 * user deletes, and that is what frees space (invariant 1); chats never go to our servers
 * (invariant 2).
 */
export default function HomePage() {
  return (
    <div className="home">
      <section className="hero sign-field" aria-labelledby="hero-title">
        <div className="wrap">
          <header className="home-nav">
            <a className="brand" href="/" aria-label="בוידעם">
              <img src="/icon-boydem.svg" alt="" width={44} height={44} />
              <span>בוידעם</span>
            </a>
            <nav className="nav-links" aria-label="ניווט">
              <a href="#how">איך זה עובד</a>
              <a href="#prices">מחירים</a>
            </nav>
          </header>

          <div className="hero-grid">
            <div className="hero-copy">
              <h1 id="hero-title">
                הטלפון מלא?
                <span className="hero-second">הצ׳אטים יכולים לגור במקום אחר.</span>
              </h1>
              <p className="lead">
                בוידעם שומר את הצ׳אטים שלכם — עם כל התמונות והסרטונים — ב־Google Drive שלכם. אחר כך
                מוחקים אותם מוואטסאפ בראש שקט, והטלפון מתפנה.
              </p>
              <div className="hero-actions">
                <GetTheApp />
                <span className="hero-note">חינם עד 5 צ׳אטים</span>
              </div>
            </div>

            <MoveScene />
          </div>
        </div>
      </section>

      <section className="how" id="how" aria-labelledby="how-title">
        <div className="wrap">
          <h2 id="how-title">ארבע הקשות בוואטסאפ</h2>
          <ol className="shots">
            {STEPS.map((text, index) => (
              <li key={index}>
                <figure>
                  <img
                    src={`/tutorial/step${index + 1}-he.png`}
                    alt={`שלב ${index + 1} בוואטסאפ: ${text}`}
                    width={390}
                    height={520}
                    loading="lazy"
                  />
                  <figcaption>
                    <span className="plate">{index + 1}</span>
                    <span>{text}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ol>
          <p className="how-then">
            <span className="plate plate-sun">אפשר למחוק</span>
            כשזה כתוב ליד הצ׳אט — מוחקים אותו בוואטסאפ בעצמכם, ומקבלים את המקום בחזרה.
          </p>
        </div>
      </section>

      <section className="board" aria-label="למה בוידעם">
        <div className="wrap">
          <ul className="board-rows">
            <li>
              <span className="board-sign" aria-hidden>
                <svg viewBox="0 0 48 48"><rect x="13" y="4" width="22" height="40" rx="5" /><rect x="19" y="36" width="10" height="3" className="cut" /></svg>
              </span>
              <h3>מקום בטלפון</h3>
              <p>התמונות עוברות ל־Drive. בטלפון נשארות רק ההודעות ותצוגה מקדימה קטנה.</p>
            </li>
            <li>
              <span className="board-sign" aria-hidden>
                <svg viewBox="0 0 48 48"><path d="M4 12a3 3 0 0 1 3-3h11l5 5h18a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" /></svg>
              </span>
              <h3>שלכם, לא שלנו</h3>
              <p>הצ׳אטים נשמרים ב־Drive שלכם, כקבצים רגילים שאפשר לפתוח גם בלי בוידעם.</p>
            </li>
            <li>
              <span className="board-sign" aria-hidden>
                <svg viewBox="0 0 48 48"><path d="M6 10h36v22H22l-10 8v-8H6z" /></svg>
              </span>
              <h3>שולחים קישור</h3>
              <p>משתפים צ׳אט, והצד השני קורא אותו בדפדפן — בלי להירשם לשום דבר.</p>
            </li>
          </ul>
        </div>
      </section>

      <section className="prices-section" id="prices" aria-labelledby="prices-title">
        <div className="wrap">
          <h2 id="prices-title">מחירים</h2>
          <div className="fares" role="table" aria-label="מחירים">
            <div className="fare" role="row">
              <span className="fare-name" role="cell">חינם</span>
              <span className="fare-scope" role="cell">עד 5 צ׳אטים</span>
              <span className="fare-amount" role="cell">₪0</span>
            </div>
            <div className="fare" role="row">
              <span className="fare-name" role="cell">רגיל</span>
              <span className="fare-scope" role="cell">עד 20 צ׳אטים</span>
              <span className="fare-amount" role="cell">
                ₪10<small> לחודש</small>
              </span>
            </div>
            <div className="fare" role="row">
              <span className="fare-name" role="cell">בלי הגבלה</span>
              <span className="fare-scope" role="cell">כל הצ׳אטים</span>
              <span className="fare-amount" role="cell">
                ₪20<small> לחודש</small>
              </span>
            </div>
          </div>
          <p className="fine">השמירה ב־Drive שלכם — גם בחבילה החינמית.</p>
        </div>
      </section>

      <section className="faq" aria-labelledby="faq-title">
        <div className="wrap wrap-narrow">
          <h2 id="faq-title">שאלות</h2>
          <details>
            <summary>בוידעם מוחק לי צ׳אטים מוואטסאפ?</summary>
            <p>לא, ואף אפליקציה לא יכולה. בוידעם שומר, ואז מראה לכם איך למחוק בעצמכם.</p>
          </details>
          <details>
            <summary>מי יכול לקרוא את הצ׳אטים?</summary>
            <p>
              הם נשמרים ב־Drive שלכם, לא אצלנו. מי שמחובר לחשבון הגוגל שלכם רואה אותם, כמו כל קובץ
              אחר שם. רוצים יותר? אפשר להגן על צ׳אט בסיסמה.
            </p>
          </details>
          <details>
            <summary>ומה אם הטלפון הולך לאיבוד?</summary>
            <p>מתקינים את בוידעם בטלפון החדש, מתחברים לאותו חשבון גוגל, והצ׳אטים חוזרים.</p>
          </details>
          <details>
            <summary>חלק מהתמונות לא נשמרו — למה?</summary>
            <p>וואטסאפ לא כולל בייצוא תמונות שכבר לא נמצאות בטלפון. זה רגיל, וההודעות עצמן כולן נשמרות.</p>
          </details>
        </div>
      </section>

      <section className="closing sign-field" aria-labelledby="closing-title">
        <div className="wrap closing-inner">
          <img src="/icon-boydem.svg" alt="" width={88} height={88} />
          <h2 id="closing-title">מפנים מקום, בלי לאבד כלום.</h2>
          <GetTheApp />
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-inner">
          <span className="footer-brand">בוידעם</span>
          <span dir="ltr">Boydem — your WhatsApp chats, in your own Google Drive.</span>
        </div>
      </footer>
    </div>
  );
}

/** The same four lines the app's tutorial uses beside the same pictures. */
const STEPS = [
  "פותחים את הצ׳אט בוואטסאפ ומקישים על השם שלו.",
  "גוללים למטה ומקישים על ״ייצוא צ׳אט״.",
  "בוחרים ״צירוף מדיה״.",
  "בוחרים בבוידעם. הצ׳אט ייפתח שם מעצמו.",
] as const;

/**
 * The product's one move, as a sign: a phone's chat bubbles travel into the attic and are counted
 * on the way in. Played once on load; with reduced motion it shows the finished state.
 *
 * The counts are an example, and say so — they are the shape of the real export pair this
 * project was verified against (127 messages, 15 media files), not a statistic about users.
 */
function MoveScene() {
  return (
    <figure className="scene" aria-label="לדוגמה: צ׳אט אחד עובר מהטלפון לבוידעם — 127 הודעות ו־15 תמונות נשמרו.">
      <svg className="scene-art" viewBox="0 0 520 400" aria-hidden>
        {/* The attic: a gable over two floors, the mark at sign scale. */}
        <g className="attic">
          <path d="M140 40 L262 146 V166 H18 V146 Z" className="solid" />
          <rect x="18" y="186" width="244" height="26" className="solid" />
          <rect x="18" y="232" width="244" height="26" className="soft" />
          <path d="M100 92 H180 a14 14 0 0 1 14 14 V124 a14 14 0 0 1 -14 14 H128 L104 156 V138 H100 a14 14 0 0 1 -14 -14 V106 a14 14 0 0 1 14 -14 Z" className="orange arrived" />
        </g>
        {/* The phone. */}
        <g className="phone">
          <rect x="336" y="36" width="160" height="300" rx="26" className="outline" />
          <rect x="386" y="52" width="60" height="10" rx="5" className="solid" />
          <path d="M366 96 H452 a10 10 0 0 1 10 10 V128 a10 10 0 0 1 -10 10 H378 L366 150 Z" className="solid bubble b1" />
          <path d="M466 168 H380 a10 10 0 0 0 -10 10 V200 a10 10 0 0 0 10 10 H454 L466 222 Z" className="orange bubble b2" />
          <path d="M366 240 H440 a10 10 0 0 1 10 10 V272 a10 10 0 0 1 -10 10 H378 L366 294 Z" className="solid bubble b3" />
          {/* What the empty phone says once the chat is in the attic. */}
          <g className="done">
            <rect x="354" y="164" width="124" height="52" rx="4" className="sun" />
            <text x="416" y="198" textAnchor="middle" className="done-label">אפשר למחוק</text>
          </g>
        </g>
      </svg>
      <figcaption className="scene-counts" aria-hidden>
        <span className="count-plate">
          <b className="count count-msgs" />
          <span>הודעות</span>
        </span>
        <span className="count-plate">
          <b className="count count-media" />
          <span>תמונות</span>
        </span>
        <span className="scene-example">לדוגמה</span>
      </figcaption>
    </figure>
  );
}
