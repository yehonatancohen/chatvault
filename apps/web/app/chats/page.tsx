"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GOOGLE_CLIENT_ID, isSignedIn, prepareSignIn, signIn, signOut } from "../../lib/google";
import { listDriveChats, type DriveChat } from "../../lib/drive-chats";

/**
 * Your chats, from your Google Drive — the same ones the phone backed up. Sign in with the
 * Google account the phone uses; nothing is sent anywhere but Google.
 */
export default function ChatsPage() {
  const [chats, setChats] = useState<DriveChat[] | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  useEffect(() => {
    prepareSignIn();
    if (isSignedIn()) void load();
  }, []);

  async function load() {
    setBusy(true);
    setProblem(undefined);
    try {
      setChats(await listDriveChats());
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    try {
      await signIn();
      await load();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <main className="open-picker" dir="auto">
      <h1>Your chats</h1>

      {GOOGLE_CLIENT_ID === "" ? (
        <p className="open-error">Google sign-in is not set up for this site yet.</p>
      ) : chats === undefined ? (
        <>
          <p>Sign in with the Google account your phone backs up to.</p>
          <button type="button" onClick={() => void connect()} disabled={busy}>
            {busy ? "Loading…" : "Sign in with Google"}
          </button>
        </>
      ) : chats.length === 0 ? (
        <p>No chats in this Google Drive yet. Back one up from the app first.</p>
      ) : (
        <ul className="chat-list">
          {chats.map((chat) => (
            <li key={chat.folderId}>
              <Link className="chat-link" href={`/chats/${chat.folderId}`}>
                {chat.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {problem !== undefined && <p className="open-error">{problem}</p>}

      {chats !== undefined && (
        <button
          type="button"
          className="quiet"
          onClick={() => {
            signOut();
            setChats(undefined);
          }}
        >
          Sign out
        </button>
      )}
    </main>
  );
}
