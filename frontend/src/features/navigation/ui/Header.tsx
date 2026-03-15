import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import {
  HeartHandshake,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";

import { useMatches } from "@/features/match";
import { HeaderUserMenu } from "./HeaderUserMenu";
import { useMatchNotifications } from "@/app/providers/realtime";
import { cn } from "@/shared/lib/utils";

export function Header() {
  const { t } = useTranslation();
  const { data: matchesResponse } = useMatches();
  const matchNotifications = useMatchNotifications();
  const unreadMessagesCount =
    matchesResponse?.matches.reduce(
      (total, match) => total + match.unreadCount,
      0,
    ) ?? 0;

  const navItems = [
    {
      label: t("common.discovery"),
      to: "/discovery",
      icon: Sparkles,
    },
    {
      label: t("common.messages"),
      to: "/chat",
      icon: MessageCircle,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : null,
    },
    {
      label: t("common.matches"),
      to: "/matches",
      icon: Users,
      badge: (matchNotifications?.unseenMatchCount ?? 0) > 0
        ? matchNotifications?.unseenMatchCount
        : null,
    },
  ];

  return (
    <>
      {/* Desktop header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur supports-backdrop-filter:bg-card/80"
      >
        <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-center gap-4 px-4 md:h-16 md:justify-start md:px-6 lg:px-8">
          <NavLink to="/discovery" className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex size-9 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20 md:size-10"
            >
              <HeartHandshake className="size-4.5 text-primary-foreground md:size-5" />
            </motion.div>
            <div>
              <div className="text-sm font-extrabold tracking-tight md:text-base">T-Match</div>
              <div className="hidden text-xs text-muted-foreground sm:block">
                {t("common.slogan")}
              </div>
            </div>
          </NavLink>

          {/* Desktop nav — pill style, centered */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/80 p-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId="nav-pill"
                          className="absolute inset-0 rounded-full bg-primary"
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                          }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-2">
                        <Icon className="size-4" />
                        {item.label}
                        {item.badge ? (
                          <span className="rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold text-foreground">
                            {item.badge}
                          </span>
                        ) : null}
                      </span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto hidden items-center gap-2 md:flex">
            <HeaderUserMenu />
          </div>
        </div>
      </motion.header>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/85 md:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-4 py-1.5 text-[11px] font-medium transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
                      {item.badge ? (
                        <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                    <span>{item.label}</span>
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
          })}

          {/* Profile tab */}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-4 py-1.5 text-[11px] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground",
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
        </div>
      </nav>
    </>
  );
}
