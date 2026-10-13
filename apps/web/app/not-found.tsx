import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הדף לא נמצא — בוידעם",
  robots: { index: false, follow: false },
};

/** A wrong address on a Hebrew site should not answer in English. */
export default function NotFound() {
  return (
    <main className="not-found">
      <span className="plate plate-sun">404</span>
      <h1>הדף הזה לא נמצא</h1>
      <p>ייתכן שהקישור נכתב לא נכון, או שהדף הוסר.</p>
      <a className="status-link" href="/">
        לדף הבית של בוידעם
      </a>
    </main>
  );
}
