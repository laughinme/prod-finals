import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  IconLayoutDashboard,
  IconLogout,
  IconUserCircle,
} from "@tabler/icons-react";

import { useAuth } from "@/app/providers/auth/useAuth";
import { useProfile } from "@/features/profile/useProfile";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Skeleton } from "@/shared/components/ui/skeleton";

export function HeaderUserMenu() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return <Skeleton className="h-11 w-32 rounded-full" />;
  }

  const email = profile?.email ?? auth?.user?.email ?? "profile@t-match.local";
  const name = profile?.username || email;
  const avatarUrl = profile?.profilePicUrl ?? null;

  const initials = name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 rounded-full border border-border bg-background/80 py-1.5 pr-3 pl-1.5 ring-offset-background transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Avatar className="h-8 w-8 border border-border">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:block">
            <p className="max-w-32 truncate text-sm font-semibold leading-none">
              {name}
            </p>
            <p className="mt-1 text-xs leading-none text-muted-foreground">
              {t("common.profile")}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" sideOffset={8}>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/profile" className="cursor-pointer">
              <IconUserCircle className="mr-2 h-4 w-4" />
              <span>{t("common.profile")}</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/dashboard" className="cursor-pointer">
              <IconLayoutDashboard className="mr-2 h-4 w-4" />
              <span>{t("common.dashboard")}</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:bg-destructive focus:text-destructive-foreground"
          onClick={() => auth?.logout()}
        >
          <IconLogout className="mr-2 h-4 w-4" />
          <span>{t("common.logout")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
