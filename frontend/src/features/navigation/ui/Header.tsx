import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import {
  HeartHandshake,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";

import { HeaderUserMenu } from "./HeaderUserMenu";
import { useMatchNotifications } from "@/app/providers/realtime";
import { cn } from "@/shared/lib/utils";

export function Header() {
  const { t } = useTranslation();
  const matchNotifications = useMatchNotifications();

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
    },
    {
      label: t("common.matches"),
      to: "/matches",
      icon: Users,
    },
  ];

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur supports-backdrop-filter:bg-card/80"
    >
      <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <NavLink to="/discovery" className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex size-10 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20"
          >
            <HeartHandshake className="size-5 text-primary-foreground" />
          </motion.div>
          <div className="hidden sm:block">
            <div className="text-base font-bold tracking-tight">T-Match</div>
            <div className="text-xs text-muted-foreground">
              {t("common.slogan")}
            </div>
          </div>
        </NavLink>

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
                      {item.to === "/matches" && (matchNotifications?.unseenMatchCount ?? 0) > 0 ? (
                        <span className="rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold text-foreground">
                          {matchNotifications?.unseenMatchCount}
                        </span>
                      ) : null}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <NavLink
            to="/chat"
            className={({ isActive }) =>
              cn(
                "flex size-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors md:hidden",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-secondary hover:text-foreground",
              )
            }
          >
            <MessageCircle className="size-4" />
          </NavLink>

          <HeaderUserMenu />
        </div>
      </div>
    </motion.header>
  );
}
