import { NavLink, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { MessageCircle } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import { NavItem } from "../model/useNavItems";
import { Logo } from "./Logo";
import { useProfile } from "@/features/profile/model/useProfile";
import { HeaderNotificationsBell } from "./HeaderNotificationsBell";

interface MobileHeaderNavProps {
  navItems: NavItem[];
}

export function MobileHeaderNav({ navItems }: MobileHeaderNavProps) {
  const headerItems = navItems.filter((item) => item.to !== "/chat");

  return (
    <div className="flex h-12 items-center justify-evenly px-2 md:hidden">
      {headerItems[0] && <MobileNavTab item={headerItems[0]} />}
      {headerItems[1] && <MobileNavTab item={headerItems[1]} />}
      <div className="shrink-0">
        <Logo compact />
      </div>
      <HeaderNotificationsBell compact />
      <MobileProfileTab />
    </div>
  );
}

export function MobileFloatingChatButton({ navItems }: { navItems: NavItem[] }) {
  const location = useLocation();
  const chatItem = navItems.find((item) => item.to === "/chat");
  if (!chatItem || location.pathname.startsWith("/chat")) return null;

  return (
    <NavLink
      to={chatItem.to}
      className="fixed bottom-6 right-4 z-9999 flex size-16 items-center justify-center rounded-full bg-primary shadow-xl transition-transform active:scale-95 md:hidden"
    >
      <div className="relative">
        <MessageCircle className="size-7 text-primary-foreground" strokeWidth={2} />
        {chatItem.badge ? (
          <span className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {chatItem.badge}
          </span>
        ) : null}
      </div>
    </NavLink>
  );
}

function MobileNavTab({ item }: { item: NavItem }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          "relative flex items-center justify-center rounded-xl p-2 transition-colors",
          isActive ? "text-primary" : "text-muted-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className="relative">
            <Icon className="size-5" strokeWidth={isActive ? 2.5 : 2} />
            {item.badge ? (
              <span className="absolute -top-1 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
                {item.badge}
              </span>
            ) : null}
          </div>
          {isActive && (
            <motion.div
              layoutId="mobile-header-nav-indicator"
              className="absolute -bottom-0.5 h-0.5 w-5 rounded-full bg-primary"
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

function MobileProfileTab() {
  const { data: profile } = useProfile();

  const name = profile?.fullName || profile?.email?.split("@")[0] || "";
  const initials = name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <NavLink
      to="/profile"
      className={({ isActive }) =>
        cn(
          "relative flex items-center justify-center rounded-full p-0.5 transition-all",
          isActive ? "ring-2 ring-primary" : "ring-1 ring-border",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Avatar className="size-6">
            {profile?.profilePicUrl && (
              <AvatarImage
                src={profile.profilePicUrl}
                alt={name}
                referrerPolicy="no-referrer"
              />
            )}
            <AvatarFallback className="text-[10px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {isActive && (
            <motion.div
              layoutId="mobile-header-nav-indicator"
              className="absolute -bottom-0.5 h-0.5 w-5 rounded-full bg-primary"
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

