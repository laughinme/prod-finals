import { motion } from "motion/react";
import { HeaderUserMenu } from "./HeaderUserMenu";
import { useNavItems } from "../model/useNavItems";
import { Logo } from "./Logo";
import { DesktopNav } from "./DesktopNav";
import { MobileHeaderNav } from "./MobileHeaderNav";

export function Header() {
  const navItems = useNavItems();

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur supports-backdrop-filter:bg-card/80"
    >
      {/* Desktop header */}
      <div className="relative mx-auto hidden h-16 max-w-7xl items-center justify-start gap-4 px-6 md:flex lg:px-8">
        <Logo />
        <DesktopNav navItems={navItems} />
        <div className="ml-auto flex items-center gap-2">
          <HeaderUserMenu />
        </div>
      </div>

      {/* Mobile header with nav */}
      <MobileHeaderNav navItems={navItems} />
    </motion.header>
  );
}
