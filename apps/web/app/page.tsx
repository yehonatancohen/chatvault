export default function HomePage() {
  return (
    <main>
      <h1>ChatVault</h1>
      <p>
        A WhatsApp chat archive you own and can actually read — encrypted on your device,
        stored where you choose, and readable without restoring a backup.
      </p>
      <p>
        <strong>What this site is for:</strong> opening an archive someone shared with you, and
        adding your own export of the same chat so the group&rsquo;s history reaches further
        back than any one person&rsquo;s export can.
      </p>
      <p>
        Right now that means a <code>.cvault</code> file someone hands you directly — by
        AirDrop, email, or a shared Drive folder — and a passphrase. Nothing you open is ever
        sent anywhere; the file is decrypted in this browser tab and nowhere else.
      </p>
      <p>
        <a href="/open">Open an archive →</a>
      </p>
    </main>
  );
}
