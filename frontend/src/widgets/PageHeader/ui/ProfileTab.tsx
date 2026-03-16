import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { cn } from "@/shared/lib/utils";

export function ProfileTab() {
  const { t } = useTranslation();

  return (
    <NavLink
      to="/profile"
      className={({ isActive }) =>
        cn(
          "relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-4 py-1.5 text-[11px] font-medium transition-colors",
          isActive ? "text-primary" : "text-muted-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive ? 2.5 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M20 21a8 8 0 0 0-16 0" />
            </svg>
          </div>
          <span>{t("common.profile")}</span>
          {isActive && (
            <motion.div
              layoutId="mobile-nav-indicator"
              className="absolute -bottom-1.5 h-0.5 w-6 rounded-full bg-primary"
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
            />
          )}
        </>
      )}
    </NavLink>
  );
}
