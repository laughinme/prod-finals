import { motion } from "motion/react";
import { ImagePlus } from "lucide-react";
import type { RefObject } from "react";

import { cn } from "@/shared/lib/utils";

type PhotoUploadIdleStateProps = {
  dropZoneRef: RefObject<HTMLDivElement | null>;
  isDragOver: boolean;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onOpenFilePicker: () => void;
};

export function PhotoUploadIdleState({
  dropZoneRef,
  isDragOver,
  onDragLeave,
  onDragOver,
  onDrop,
  onOpenFilePicker,
}: PhotoUploadIdleStateProps) {
  return (
    <motion.div
      key="dropzone"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      ref={dropZoneRef}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onOpenFilePicker}
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
              ? "scale-110 bg-primary/15"
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

        <p className="text-2xl font-bold text-black">Добавить фото</p>
      </div>
    </motion.div>
  );
}
