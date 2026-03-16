import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { HeartHandshake } from "lucide-react";

export function Logo() {
  const { t } = useTranslation();

  return (
    <NavLink to="/discovery" className="flex items-center gap-3">
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex size-9 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20 md:size-10"
      >
        <HeartHandshake className="size-4.5 text-primary-foreground md:size-5" />
      </motion.div>
      <div>
        <div className="text-sm font-extrabold tracking-tight md:text-base">
          T-Match
        </div>
        <div className="hidden text-xs text-muted-foreground sm:block">
          {t("common.slogan")}
        </div>
      </div>
    </NavLink>
  );
}
