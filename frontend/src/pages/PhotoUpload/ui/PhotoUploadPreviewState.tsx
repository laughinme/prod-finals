import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Camera, CheckCircle2, Upload } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import type { PhotoUploadState } from "@/pages/PhotoUpload/model";

type PhotoUploadPreviewStateProps = {
  onOpenFilePicker: () => void;
  onUpload: () => void;
  preview: string | null;
  progress: number;
  uploadState: Exclude<PhotoUploadState, "idle">;
};

export function PhotoUploadPreviewState({
  onOpenFilePicker,
  onUpload,
  preview,
  progress,
  uploadState,
}: PhotoUploadPreviewStateProps) {
  return (
    <motion.div
      key="preview-area"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="overflow-hidden rounded-3xl border border-border bg-card shadow-lg"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-secondary/30">
        {preview ? (
          <motion.img
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            src={preview}
            alt="Preview"
            className="h-full w-full object-cover"
          />
        ) : null}

        <AnimatePresence>
          {uploadState === "uploading" ? (
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
              <p className="text-lg font-semibold text-white">Загрузка...</p>
              <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-white/20">
                <motion.div
                  className="h-full rounded-full bg-white"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {uploadState === "done" ? (
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
          ) : null}
        </AnimatePresence>

        {uploadState === "preview" ? (
          <>
            <button
              onClick={onOpenFilePicker}
              className="absolute top-4 right-4 flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            >
              <Camera className="size-4" />
              Изменить
            </button>

            <Button
              size="sm"
              className="absolute bottom-4 left-1/2 h-11 min-w-36 -translate-x-1/2 rounded-full px-6 text-sm font-semibold shadow-lg shadow-primary/30"
              onClick={onUpload}
            >
              Продолжить
              <ArrowRight className="size-4" />
            </Button>
          </>
        ) : null}
      </div>
    </motion.div>
  );
}
