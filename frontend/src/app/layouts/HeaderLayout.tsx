import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";

import { Header } from "@/features/navigation/ui/Header";

export function HeaderLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <Header />
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="flex flex-1 flex-col"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
