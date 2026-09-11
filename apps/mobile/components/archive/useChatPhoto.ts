import { useCallback, useEffect, useState } from "react";
import { readPreferences, updatePreferences } from "../../lib/archive/preferences";
import { useApp } from "../app/providers";
import type { LightboxAction, LightboxSubject } from "./Lightbox";

/**
 * The chat photo the user chose, for the screens that show or change it.
 *
 * A WhatsApp export carries no chat icon, so this is only ever a choice the user made — see
 * `ArchivePreferences.chatPhotoSha256`. `undefined` means initials, which is the default.
 */
export function useChatPhoto(archiveId: string): {
  chatPhotoSha256: string | undefined;
  setChatPhoto: (sha256: string | undefined) => Promise<void>;
  lightboxAction: (subject: LightboxSubject | undefined) => LightboxAction | undefined;
} {
  const { t } = useApp();
  const [chatPhotoSha256, setSha] = useState<string | undefined>(undefined);

  useEffect(() => {
    let stale = false;
    void (async () => {
      const preferences = await readPreferences(archiveId);
      if (!stale) setSha(preferences.chatPhotoSha256);
    })();
    return () => {
      stale = true;
    };
  }, [archiveId]);

  const setChatPhoto = useCallback(
    async (sha256: string | undefined): Promise<void> => {
      await updatePreferences(archiveId, { chatPhotoSha256: sha256 });
      setSha(sha256);
    },
    [archiveId],
  );

  /** The lightbox button that makes the photo on screen the chat's photo. */
  const lightboxAction = useCallback(
    (subject: LightboxSubject | undefined): LightboxAction | undefined => {
      const sha256 = subject?.sha256;
      if (sha256 === undefined) return undefined;
      return sha256 === chatPhotoSha256
        ? { label: t("chatPhoto.current"), onPress: () => {}, disabled: true }
        : { label: t("chatPhoto.use"), onPress: () => void setChatPhoto(sha256) };
    },
    [chatPhotoSha256, setChatPhoto, t],
  );

  return { chatPhotoSha256, setChatPhoto, lightboxAction };
}
