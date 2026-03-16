import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import * as Sentry from "@sentry/react";
import { useTranslation } from "react-i18next";

import { useQueryClient } from "@tanstack/react-query";

import { getOnboardingState } from "@/shared/api/onboarding";
import { uploadProfilePicture } from "@/shared/api/profile";
import type { User } from "@/entities/user/model";

export type PhotoUploadState = "idle" | "preview" | "uploading" | "done";

const PROFILE_KEY = ["profile", "me"] as const;
const ONBOARDING_STATE_KEY = ["onboarding", "state"] as const;
const DONE_ANIMATION_MS = 1500;

export function usePhotoUpload() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<PhotoUploadState>("idle");
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const handleFile = useCallback(
    (selectedFile: File) => {
      const validTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!validTypes.includes(selectedFile.type)) {
        setError(t("photo_upload.error_unsupported_type"));
        return;
      }

      if (selectedFile.size > 10 * 1024 * 1024) {
        setError(t("photo_upload.error_too_large"));
        return;
      }

      if (preview?.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }

      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setUploadState("preview");
      setError(null);
    },
    [preview, t],
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
    event.target.value = "";
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      return;
    }

    setUploadState("uploading");
    setError(null);

    const progressInterval = setInterval(() => {
      setProgress((previousProgress) => {
        if (previousProgress >= 90) {
          clearInterval(progressInterval);
          return 90;
        }

        return previousProgress + Math.random() * 15;
      });
    }, 200);

    try {
      const updatedProfile = await uploadProfilePicture(file);
      clearInterval(progressInterval);
      setProgress(100);
      setUploadState("done");

      await new Promise((r) => setTimeout(r, DONE_ANIMATION_MS));
      queryClient.setQueryData<User>(PROFILE_KEY, updatedProfile);
      await queryClient.invalidateQueries({ queryKey: ONBOARDING_STATE_KEY });
      const nextOnboardingState = await queryClient.fetchQuery({
        queryKey: ONBOARDING_STATE_KEY,
        queryFn: getOnboardingState,
        staleTime: 0,
      });
      queryClient.setQueryData(ONBOARDING_STATE_KEY, nextOnboardingState);
    } catch (error) {
      Sentry.captureException(error);
      clearInterval(progressInterval);
      setProgress(0);
      setUploadState("preview");
      setError(t("photo_upload.error_failed"));
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return {
    dropZoneRef,
    error,
    fileInputRef,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleInputChange,
    handleUpload,
    isDragOver,
    openFilePicker,
    preview,
    progress,
    uploadState,
  };
}
