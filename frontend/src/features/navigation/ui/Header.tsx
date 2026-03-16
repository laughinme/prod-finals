import { motion } from "motion/react";
import { HeaderUserMenu } from "./HeaderUserMenu";
import { useNavItems } from "../model/useNavItems";
import { Logo } from "./Logo";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";

export function Header() {
  const navItems = useNavItems();

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur supports-backdrop-filter:bg-card/80"
      >
        <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-center gap-4 px-4 md:h-16 md:justify-start md:px-6 lg:px-8">
          <Logo />

          <DesktopNav navItems={navItems} />

          <div className="ml-auto hidden items-center gap-2 md:flex">
            <HeaderUserMenu />
          </div>
        </div>
      </motion.header>

      <MobileNav navItems={navItems} />
    </>
  );
}
