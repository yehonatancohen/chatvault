import { GetTheApp } from "./_components/GetTheApp";

/**
 * The home page: what Boydem is, why, and what it costs — every path leads to the app.
 *
 * The website has exactly two jobs (owner, 2026-09-11): this page, and a chat someone shared
 * (`/s/<id>`). No sign-in, no tools. Hebrew, RTL.
 *
 * Copy rules: Boydem never deletes from WhatsApp and never claims to free storage itself — the
 * user deletes, and that is what frees space (invariant 1); chats never go to our servers
 * (invariant 2).
 */
export default function HomePage() {
  return (
    <div className="home">
      <header className="home-nav">
        <div className="brand">
          <img src="/icon-boydem.svg" alt="" width={34} height={34} />
          <span>בוידעם</span>
        </div>
        <a className="nav-link" href="#prices">מחירים</a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">לוואטסאפ · לאייפון</p>
          <h1>
            הטלפון מלא?
            <br />
            <span className="wood">הצ׳אטים יכולים לגור במקום אחר.</span>
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

        <PhoneMock />
      </section>

      <section className="section">
        <h2>שלושה צעדים</h2>
        <ol className="steps">
          <li>
            <span className="step-number">1</span>
            <h3>מייצאים</h3>
            <p>בוואטסאפ: פרטי הצ׳אט ← ייצוא צ׳אט ← בוידעם.</p>
          </li>
          <li>
            <span className="step-number">2</span>
            <h3>נשמר ומגובה</h3>
            <p>בוידעם שומר את הצ׳אט ומעלה אותו ל־Drive שלכם, גם כשעוברים לאפליקציה אחרת.</p>
          </li>
          <li>
            <span className="step-number">3</span>
            <h3>מוחקים בוואטסאפ</h3>
            <p>כשכתוב ״אפשר למחוק״ — מוחקים את הצ׳אט בעצמכם, ומקבלים את המקום בחזרה.</p>
          </li>
        </ol>
      </section>

      <section className="band">
        <div className="band-inner">
          <div className="point">
            <div className="point-icon" aria-hidden>
              <svg viewBox="0 0 24 24"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></svg>
            </div>
            <h3>מקום בטלפון</h3>
            <p>התמונות עוברות ל־Drive. בטלפון נשארות רק ההודעות ותצוגה מקדימה קטנה.</p>
          </div>
          <div className="point">
            <div className="point-icon" aria-hidden>
              <svg viewBox="0 0 24 24"><path d="M3 7.5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
            </div>
            <h3>שלכם, לא שלנו</h3>
            <p>הצ׳אטים נשמרים ב־Drive שלכם, כקבצים רגילים שאפשר לפתוח גם בלי בוידעם.</p>
          </div>
          <div className="point">
            <div className="point-icon" aria-hidden>
              <svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
            </div>
            <h3>שולחים קישור</h3>
            <p>משתפים צ׳אט, והצד השני קורא אותו בדפדפן — בלי להירשם לשום דבר.</p>
          </div>
        </div>
      </section>

      <section className="section" id="prices">
        <h2>מחירים</h2>
        <div className="prices">
          <div className="price">
            <h3>חינם</h3>
            <div className="amount">₪0</div>
            <p>עד 5 צ׳אטים</p>
          </div>
          <div className="price featured">
            <div className="badge">הכי נפוץ</div>
            <h3>רגיל</h3>
            <div className="amount">
              ₪10<span> לחודש</span>
            </div>
            <p>עד 20 צ׳אטים</p>
          </div>
          <div className="price">
            <h3>בלי הגבלה</h3>
            <div className="amount">
              ₪20<span> לחודש</span>
            </div>
            <p>כל הצ׳אטים</p>
          </div>
        </div>
        <p className="fine">השמירה ב־Drive שלכם — גם בחבילה החינמית.</p>
      </section>

      <section className="section faq">
        <h2>שאלות</h2>
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
      </section>

      <section className="closing">
        <h2>מפנים מקום, בלי לאבד כלום.</h2>
        <GetTheApp />
      </section>

      <footer className="footer">
        <span>בוידעם</span>
        <span dir="ltr">Boydem — your WhatsApp chats, in your own Google Drive.</span>
      </footer>
    </div>
  );
}

/** A drawn iPhone showing the chat list and its statuses — the product, not a description of it. */
function PhoneMock() {
  const rows = [
    { initials: "מ", color: "#b5654a", name: "משפחה ❤️", preview: "אמא: מי מגיע בשבת?", status: "safe" as const },
    { initials: "ח", color: "#4f7a64", name: "חברים מהצבא", preview: "📷 תמונה", status: "uploading" as const },
    { initials: "ד", color: "#6a5a9a", name: "דנה", preview: "נדבר מחר", status: "deleted" as const },
    { initials: "ו", color: "#8a6d1f", name: "ועד הבית", preview: "המעלית תוקנה", status: "device" as const },
  ];
  return (
    <div className="phone" aria-hidden>
      <div className="phone-notch" />
      <div className="phone-title">צ׳אטים</div>
      <div className="phone-sub">4 צ׳אטים · 3.8 GB</div>
      {rows.map((row) => (
        <div className="phone-row" key={row.name}>
          <div className="phone-avatar" style={{ background: row.color }}>
            {row.initials}
          </div>
          <div className="phone-text">
            <div className="phone-name">{row.name}</div>
            <div className="phone-preview">{row.preview}</div>
            {row.status === "uploading" ? (
              <div className="phone-progress">
                <span>מעלה 64%</span>
                <div className="bar">
                  <div style={{ width: "64%" }} />
                </div>
              </div>
            ) : (
              <span className={`pill pill-${row.status}`}>
                {row.status === "safe" ? "אפשר למחוק" : row.status === "deleted" ? "נמחק · ב־Drive" : "בטלפון הזה"}
              </span>
            )}
          </div>
        </div>
      ))}
      <div className="phone-tabs">
        <span className="active">צ׳אטים</span>
        <span>הוספה</span>
        <span>חשבון</span>
        <span>הגדרות</span>
      </div>
    </div>
  );
}
