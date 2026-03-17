import { Outlet } from "react-router-dom";

import { Header } from "@/widgets/PageHeader";
import { MobileFloatingChatButton } from "@/widgets/PageHeader";
import { useNavItems } from "@/widgets/PageHeader/model/useNavItems";

export function HeaderLayout() {
  const navItems = useNavItems();

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
      <Header />
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
      <MobileFloatingChatButton navItems={navItems} />
    </div>
  );
}
