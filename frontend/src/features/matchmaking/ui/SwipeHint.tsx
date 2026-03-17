import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

const COOKIE_NAME = "t-match-show-swipe-hint";

function hasCookie(name: string): boolean {
  return document.cookie.split("; ").some((cookie) => cookie.startsWith(name + "="));
}

function deleteCookie(name: string) {
  document.cookie = `${name}=;path=/;max-age=0`;
}

export function SwipeHint() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => hasCookie(COOKIE_NAME));

  useEffect(() => {
    if (!visible) {
      return;
    }

    deleteCookie(COOKIE_NAME);
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-60 flex flex-col items-center justify-center bg-black/65 backdrop-blur-[3px]"
          onClick={() => setVisible(false)}
        >
          <div className="relative flex w-full max-w-145 items-center px-2 sm:px-4">
            <motion.div
              animate={{ x: [-8, 4, -8] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
              className="flex shrink-0 flex-col items-center gap-1.5"
            >
              <span className="text-sm font-bold text-white drop-shadow-md sm:text-lg">
                {t("discovery.swipe_hint_pass")}
              </span>
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-white/15 shadow-xl backdrop-blur-sm sm:h-20 sm:w-20">
                <ChevronLeft className="h-7 w-7 text-white sm:h-10 sm:w-10" />
              </div>
            </motion.div>

            <div className="flex flex-1 flex-col items-center gap-1.5 px-2 text-center sm:gap-2 sm:px-3">
              <p className="text-base font-extrabold text-white drop-shadow-lg sm:text-xl">
                {t("discovery.swipe_hint_title")}
              </p>
              <p className="text-xs leading-snug text-white/85 sm:text-sm">
                {t("discovery.swipe_hint_right_like")}
              </p>
              <p className="text-xs leading-snug text-white/85 sm:text-sm">
                {t("discovery.swipe_hint_left_pass")}
              </p>
            </div>

            <motion.div
              animate={{ x: [8, -4, 8] }}
              transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
              className="flex shrink-0 flex-col items-center gap-1.5"
            >
              <span className="text-sm font-bold text-white drop-shadow-md sm:text-lg">
                {t("discovery.swipe_hint_like")}
              </span>
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-white/15 shadow-xl backdrop-blur-sm sm:h-20 sm:w-20">
                <ChevronRight className="h-7 w-7 text-white sm:h-10 sm:w-10" />
              </div>
            </motion.div>
          </div>

          <p className="mt-10 text-sm text-white/50">{t("discovery.swipe_hint_tap_dismiss")}</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
