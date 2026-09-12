"use client";

import { useEffect, useState } from "react";
import { DriveAccessCancelled, requestDriveAccess } from "../../lib/google-oauth";
import { AlreadySavedError, saveToMyDrive, type SaveProgress } from "../../lib/save-to-drive";
import type { SharedChat } from "../../lib/shared-chat";
import { GetTheApp } from "./GetTheApp";

interface SaveChatProps {
  readonly chat: SharedChat;
  readonly onClose: () => void;
}

type Stage =
  | { readonly kind: "offer" }
  | { readonly kind: "working"; readonly progress?: SaveProgress | undefined }
  | { readonly kind: "saved"; readonly folderUrl: string; readonly already: boolean }
  | { readonly kind: "problem"; readonly message: string };

/**
 * Keeping a copy of a chat someone shared with you.
 *
 * The copy goes into the visitor's **own** Google Drive (`lib/save-to-drive.ts`) — there is
 * nowhere else it could go: chats never live on Boydem's servers, not even for a moment, and a
 * Boydem account is not a place to put a chat, it is a record of one (`ACCOUNTS-AND-CLOUD.md`).
 * So the same button serves someone who already has an account and someone who has never heard
 * of us: sign into the Google account you use — or would use — with the app, and the chat lands
 * where the app looks for it.
 *
 * Two things the visitor is told before they start, because both are true and neither is
 * obvious: a chat kept this way counts as one of their chats, and the app reads it better than
 * a browser can.
 */
export function SaveChat({ chat, onClose }: SaveChatProps) {
  const [stage, setStage] = useState<Stage>({ kind: "offer" });

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && stage.kind !== "working") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, stage.kind]);

  async function save(): Promise<void> {
    try {
      // Must be the first thing after the click: a `window.open` any later than this is a popup
      // the browser blocks.
      const token = await requestDriveAccess();
      setStage({ kind: "working" });
      const { folderUrl } = await saveToMyDrive(chat, token, (progress) =>
        setStage({ kind: "working", progress }),
      );
      setStage({ kind: "saved", folderUrl, already: false });
    } catch (error) {
      if (error instanceof DriveAccessCancelled) {
        setStage({ kind: "offer" });
        return;
      }
      if (error instanceof AlreadySavedError) {
        setStage({ kind: "saved", folderUrl: error.folderUrl, already: true });
        return;
      }
      setStage({ kind: "problem", message: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <div className="sheet-backdrop" onClick={() => stage.kind !== "working" && onClose()} role="presentation">
      <aside className="dialog" onClick={(event) => event.stopPropagation()} aria-label="שמירת הצ׳אט">
        {stage.kind === "saved" ? (
          <>
            <h2>{stage.already ? "הצ׳אט כבר שמור אצלכם" : "הצ׳אט נשמר ב-Drive שלכם"}</h2>
            <p>האפליקציה מוצאת אותו שם — ומשם אפשר לקרוא אותו גם בלי חיבור, ולהוסיף לו ייצוא משלכם.</p>
            <a className="dialog-link" href={stage.folderUrl} target="_blank" rel="noreferrer noopener">
              פתיחה ב-Google Drive
            </a>
            <GetTheApp />
            <button type="button" className="dialog-quiet" onClick={onClose}>
              סגירה
            </button>
          </>
        ) : stage.kind === "working" ? (
          <>
            <h2>מעתיקים את הצ׳אט ל-Drive שלכם</h2>
            <p>
              {stage.progress === undefined
                ? "מתחילים…"
                : `${stage.progress.done.toLocaleString("he-IL")} מתוך ${stage.progress.total.toLocaleString("he-IL")} קבצים הועתקו`}
            </p>
            <div className="progress">
              <div
                style={{
                  width:
                    stage.progress === undefined || stage.progress.total === 0
                      ? "5%"
                      : `${Math.round((stage.progress.done / stage.progress.total) * 100)}%`,
                }}
              />
            </div>
            <p className="dialog-fine">אל תסגרו את החלון עד שנסיים.</p>
          </>
        ) : (
          <>
            <h2>לשמור את הצ׳אט אצלכם</h2>
            <p>
              הצ׳אט יועתק ל-Google Drive שלכם, עם התמונות, בלי לעבור דרכנו. התחברו לחשבון Google
              שאתם משתמשים בו באפליקציה — והצ׳אט יחכה לכם שם.
            </p>
            <p className="dialog-fine">
              צ׳אט ששמרתם כך נספר במכסת הצ׳אטים שלכם. באפליקציה הצ׳אט נקרא יותר טוב — ועובד גם בלי חיבור.
            </p>
            {chat.protected && (
              <p className="dialog-fine">
                הצ׳אט הזה מוגן בסיסמת מעבר. העותק נשמר מוגן כמו שהוא, ונפתח רק עם הקישור המלא ששיתפו איתכם.
              </p>
            )}
            {stage.kind === "problem" && <p className="dialog-problem">{stage.message}</p>}
            <button type="button" className="dialog-cta" onClick={() => void save()}>
              שמירה ל-Google Drive שלי
            </button>
            <button type="button" className="dialog-quiet" onClick={onClose}>
              לא עכשיו
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
