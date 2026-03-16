import { useState, useRef, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";

import type { MatchProfileCategoryScore } from "../model/types";

type ScoreBreakdownPopoverProps = {
  categories: MatchProfileCategoryScore[];
  children: ReactNode;
};

export function ScoreBreakdownPopover({
  categories,
  children,
}: ScoreBreakdownPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [open]);

  if (categories.length === 0) {
    return <>{children}</>;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="cursor-pointer select-text"
      >
        {children}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute top-full left-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-xl"
          >
            <p className="mb-2.5 text-xs font-semibold text-muted-foreground">
              {t("common.compatibility_by_categories")}
            </p>
            <div className="space-y-2.5">
              {categories.map((cat) => (
                <div key={cat.categoryKey}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">
                      {cat.label}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {cat.scorePercent}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${cat.scorePercent}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
