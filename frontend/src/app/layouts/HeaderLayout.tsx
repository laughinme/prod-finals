import { Outlet } from "react-router-dom";

import { Header } from "@/features/navigation/ui/Header";

export function HeaderLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <Header />
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
