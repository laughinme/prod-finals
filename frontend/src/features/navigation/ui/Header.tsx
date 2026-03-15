import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import {
  HeartHandshake,
  LayoutDashboard,
  MessageCircle,
  Sparkles,
  Users,
} from "lucide-react";

import { HeaderUserMenu } from "./HeaderUserMenu";
import { cn } from "@/shared/lib/utils";

export function Header() {
  const { t } = useTranslation();

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
    {
      label: t("common.dashboard"),
      to: "/dashboard",
      icon: LayoutDashboard,
    },
  ];

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur supports-backdrop-filter:bg-card/80"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
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

        <nav className="hidden items-center gap-1 rounded-full border border-border bg-background/80 p-1 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )
                }
              >
                <Icon className="size-4" />
                {item.label}
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

          <div className="hidden rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground lg:block">
            mock flow
          </div>

          <HeaderUserMenu />
        </div>
      </div>
    </motion.header>
  );
}
