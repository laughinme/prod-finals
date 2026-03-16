import { useTranslation } from "react-i18next";
import { IconLogout } from "@tabler/icons-react";

import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { cn } from "@/shared/lib/utils";

export type ProfileTab = "profile" | "filters";

interface ProfileNavigationProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  onLogout: () => void;
  variant: "desktop" | "mobile";
}

export function ProfileNavigation({
  activeTab,
  onTabChange,
  onLogout,
  variant,
}: ProfileNavigationProps) {
  const { t } = useTranslation();

  if (variant === "desktop") {
    return (
      <nav className="mt-16 hidden w-40 shrink-0 flex-col gap-1 md:flex">
        <button
          type="button"
          onClick={() => onTabChange("profile")}
          className={cn(
            "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
            activeTab === "profile"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {t("profile.tab_profile")}
        </button>
        <button
          type="button"
          onClick={() => onTabChange("filters")}
          className={cn(
            "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
            activeTab === "filters"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {t("profile.tab_filters")}
        </button>

        <Separator className="my-2" />

        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-destructive hover:text-destructive"
          onClick={onLogout}
        >
          <IconLogout className="mr-2 size-4" color="currentColor" />
          {t("common.logout")}
        </Button>
      </nav>
    );
  }

  return (
    <div className="flex items-center border-b border-border/40 md:hidden">
      <button
        type="button"
        onClick={() => onTabChange("profile")}
        className={cn(
          "border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
          activeTab === "profile"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground",
        )}
      >
        {t("profile.tab_profile")}
      </button>
      <button
        type="button"
        onClick={() => onTabChange("filters")}
        className={cn(
          "border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
          activeTab === "filters"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground",
        )}
      >
        {t("profile.tab_filters")}
      </button>

      <Button
        variant="ghost"
        size="sm"
        className="ml-auto text-muted-foreground hover:text-destructive"
        onClick={onLogout}
      >
        <IconLogout className="size-4" />
      </Button>
    </div>
  );
}
