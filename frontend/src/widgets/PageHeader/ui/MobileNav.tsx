import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { cn } from "@/shared/lib/utils";
import { NavItem } from "../model/useNavItems";
import { ProfileTab } from "./ProfileTab";

interface MobileNavProps {
  navItems: NavItem[];
}

export function MobileNav({ navItems }: MobileNavProps) {
  return (
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
                  isActive ? "text-primary" : "text-muted-foreground",
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

        <ProfileTab />
      </div>
    </nav>
  );
}
