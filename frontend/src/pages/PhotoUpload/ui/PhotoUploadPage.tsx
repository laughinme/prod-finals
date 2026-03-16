import { motion, AnimatePresence } from "motion/react";

import { usePhotoUpload } from "@/pages/PhotoUpload/model";
import { PhotoUploadBackground } from "./PhotoUploadBackground";
import { PhotoUploadIdleState } from "./PhotoUploadIdleState";
import { PhotoUploadPreviewState } from "./PhotoUploadPreviewState";
import { PhotoUploadHeader } from "./PhotoUploadHeader";

export default function PhotoUploadPage() {
  const {
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
  } = usePhotoUpload();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-8">
      <PhotoUploadBackground />

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
        <PhotoUploadHeader></PhotoUploadHeader>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
        >
          <AnimatePresence mode="wait">
            {uploadState === "idle" ? (
              <PhotoUploadIdleState
                dropZoneRef={dropZoneRef}
                isDragOver={isDragOver}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onOpenFilePicker={openFilePicker}
              />
            ) : (
              <PhotoUploadPreviewState
                onOpenFilePicker={openFilePicker}
                onUpload={handleUpload}
                preview={preview}
                progress={progress}
                uploadState={uploadState}
              />
            )}
          </AnimatePresence>
        </motion.div>

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
