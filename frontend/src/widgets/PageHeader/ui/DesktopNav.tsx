import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { cn } from "@/shared/lib/utils";
import { NavItem } from "../model/useNavItems";

interface DesktopNavProps {
  navItems: NavItem[];
}

export function DesktopNav({ navItems }: DesktopNavProps) {
  return (
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
  );
}
