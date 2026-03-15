import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import * as Sentry from "@sentry/react";

import { useUploadAvatar } from "@/features/profile/useProfile";

export type PhotoUploadState = "idle" | "preview" | "uploading" | "done";

export function usePhotoUpload() {
  const { mutateAsync: uploadAvatar } = useUploadAvatar();

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
        setError("Поддерживаются только JPEG, PNG и WebP");
        return;
      }

      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("Максимальный размер файла — 10 МБ");
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
    [preview],
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
      await uploadAvatar(file);
      clearInterval(progressInterval);
      setProgress(100);
      setUploadState("done");
    } catch (error) {
      Sentry.captureException(error);
      clearInterval(progressInterval);
      setProgress(0);
      setUploadState("preview");
      setError("Не удалось загрузить фото. Попробуйте ещё раз.");
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
