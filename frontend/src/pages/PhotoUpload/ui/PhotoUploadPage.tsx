import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ImagePlus,
  Upload,
} from "lucide-react";

import { useMatchmakingFlow } from "@/features/matchmaking/model";
import { useUploadAvatar } from "@/features/profile/useProfile";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

type UploadState = "idle" | "preview" | "uploading" | "done";

export default function PhotoUploadPage() {
  const navigate = useNavigate();
  const { completeOnboarding, draft } = useMatchmakingFlow();
  const { mutateAsync: uploadAvatar } = useUploadAvatar();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFile(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploadState("uploading");
    setError(null);

    // Simulate progress for better UX
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      await uploadAvatar(file);
      clearInterval(progressInterval);
      setProgress(100);
      setUploadState("done");

      // Brief celebration, then navigate
      setTimeout(() => {
        completeOnboarding({ ...draft, photoUploaded: true });
        navigate("/discovery", { replace: true });
      }, 1500);
    } catch {
      clearInterval(progressInterval);
      setProgress(0);
      setUploadState("preview");
      setError("Не удалось загрузить фото. Попробуйте ещё раз.");
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-8">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.03]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="photo-upload-dots"
              x="0"
              y="0"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2" cy="2" r="1.5" fill="#111827" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#photo-upload-dots)" />
        </svg>

        <div className="absolute top-[10%] left-[8%] h-24 w-24 rotate-12 rounded-[20px] bg-[#1C1C1E] shadow-[0_16px_40px_rgba(0,0,0,0.12)] md:h-32 md:w-32 md:rounded-[28px]" />

        <div className="absolute top-[15%] right-[12%] -rotate-12 drop-shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
          <div className="relative h-12 w-12 rotate-45 bg-[#FFDD2D] before:absolute before:left-0 before:-top-1/2 before:h-full before:w-full before:rounded-full before:bg-[#FFDD2D] before:content-[''] after:absolute after:top-0 after:-left-1/2 after:h-full after:w-full after:rounded-full after:bg-[#FFDD2D] after:content-[''] md:h-16 md:w-16" />
        </div>

        <div className="absolute top-[5%] left-[45%] h-4 w-12 rotate-45 rounded-full bg-[#1C1C1E] shadow-[0_8px_20px_rgba(0,0,0,0.1)] md:h-5 md:w-16" />

        <div className="absolute top-[45%] left-[5%] -rotate-[30deg] drop-shadow-[0_8px_20px_rgba(0,0,0,0.1)]">
          <div className="relative h-6 w-6 rotate-45 bg-[#1C1C1E] before:absolute before:left-0 before:-top-1/2 before:h-full before:w-full before:rounded-full before:bg-[#1C1C1E] before:content-[''] after:absolute after:top-0 after:-left-1/2 after:h-full after:w-full after:rounded-full after:bg-[#1C1C1E] after:content-[''] md:h-8 md:w-8" />
        </div>

        <div className="absolute top-[55%] right-[4%] h-16 w-16 rotate-45 rounded-[16px] bg-[#FFDD2D] shadow-[0_12px_30px_rgba(0,0,0,0.08)] md:h-20 md:w-20" />

        <div className="absolute bottom-[15%] left-[12%] h-8 w-20 -rotate-12 rounded-full bg-[#FFDD2D] shadow-[0_12px_30px_rgba(0,0,0,0.08)] md:h-10 md:w-28" />

        <div className="absolute right-[10%] bottom-[15%] rotate-[15deg] drop-shadow-[0_20px_50px_rgba(0,0,0,0.12)]">
          <div className="relative h-16 w-16 rotate-45 bg-[#1C1C1E] before:absolute before:left-0 before:-top-1/2 before:h-full before:w-full before:rounded-full before:bg-[#1C1C1E] before:content-[''] after:absolute after:top-0 after:-left-1/2 after:h-full after:w-full after:rounded-full after:bg-[#1C1C1E] after:content-[''] md:h-20 md:w-20" />
        </div>

        <div className="absolute bottom-[5%] left-[50%] h-12 w-12 rounded-full bg-[#1C1C1E] shadow-[0_12px_30px_rgba(0,0,0,0.08)] md:h-16 md:w-16" />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-lg"
      >
        {/* Header */}
        <div className="mb-8">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full text-center text-4xl font-black uppercase tracking-wide text-black"
          >
            Добавьте фото
          </motion.h1>
        </div>

        {/* Upload area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <AnimatePresence mode="wait">
            {uploadState === "idle" ? (
              <motion.div
                key="dropzone"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "group relative cursor-pointer overflow-hidden rounded-3xl border-4 border-dashed border-black bg-white transition-all duration-300",
                  isDragOver && "scale-[1.02]",
                )}
              >
                <div className="flex aspect-square flex-col items-center justify-center px-8">
                  <div
                    className={cn(
                      "mb-6 flex size-20 items-center justify-center rounded-full transition-all duration-300",
                      isDragOver
                        ? "bg-primary/15 scale-110"
                        : "bg-secondary group-hover:bg-primary/10",
                    )}
                  >
                    <ImagePlus
                      className={cn(
                        "size-9 transition-colors duration-300",
                        isDragOver
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-primary",
                      )}
                    />
                  </div>

                  <p className="text-2xl font-bold text-black">
                    Добавить фото
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="preview-area"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg"
              >
                {/* Photo preview */}
                <div className="relative aspect-square w-full overflow-hidden bg-secondary/30">
                  {preview && (
                    <motion.img
                      initial={{ scale: 1.1, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.4 }}
                      src={preview}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  )}

                  {/* Overlay for uploading state */}
                  <AnimatePresence>
                    {uploadState === "uploading" && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm"
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="mb-4"
                        >
                          <Upload className="size-10 text-white" />
                        </motion.div>
                        <p className="text-lg font-semibold text-white">
                          Загрузка...
                        </p>
                        <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-white/20">
                          <motion.div
                            className="h-full rounded-full bg-white"
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Success overlay */}
                  <AnimatePresence>
                    {uploadState === "done" && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 15 }}
                        >
                          <CheckCircle2 className="size-16 text-green-400" />
                        </motion.div>
                        <motion.p
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="mt-4 text-xl font-semibold text-white"
                        >
                          Отлично!
                        </motion.p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Preview actions */}
                  {uploadState === "preview" && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute top-4 right-4 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                    >
                      <Camera className="size-4" />
                      Изменить
                    </button>
                  )}

                  {uploadState === "preview" && (
                    <>
                      <Button
                        size="sm"
                        className="absolute bottom-4 left-1/2 h-11 min-w-36 -translate-x-1/2 rounded-full px-6 text-sm font-semibold shadow-lg shadow-primary/30"
                        onClick={handleUpload}
                      >
                        Продолжить
                        <ArrowRight className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Error message */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="mt-4 text-center text-sm font-medium text-destructive"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
