import { t } from "i18next";
import { motion } from "motion/react";

export function PhotoUploadHeader() {
  return (
    <div className="mb-8">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full text-center text-4xl font-black uppercase tracking-wide text-black"
      >
        {t("photo_upload.title")}
      </motion.h1>
    </div>
  );
}
