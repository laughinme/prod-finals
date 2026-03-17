import { useState } from "react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  AlertCircle,
  UserX,
  UserCheck,
  Calendar,
  Mail,
  User as UserIcon,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Separator } from "@/shared/components/ui/separator";

import { useBanUser } from "../model/use-ban-user";
import { useModerationUsers } from "../model/use-moderation-users";

type ModerationPageProps = {
  embedded?: boolean;
};

export function ModerationPage({ embedded = false }: ModerationPageProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<"all" | "banned" | "active">("all");

  const apiFilter = {
    banned: filter === "all" ? null : filter === "banned",
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useModerationUsers(apiFilter);

  const { mutate: toggleBan, isPending: isBanning } = useBanUser();

  const handleToggleBan = (userId: string, currentStatus: boolean) => {
    toggleBan({ userId, isBanned: !currentStatus });
  };

  const users = (data?.pages.flatMap((page) => page.items) || []).filter(
    (u): u is NonNullable<typeof u> => Boolean(u && u.id),
  );

  const formatCreatedAt = (value?: string | Date | null) => {
    if (!value) return t("admin.moderation_page.date_unavailable");
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      return t("admin.moderation_page.date_unavailable");
    return format(date, "MMM d, yyyy");
  };

  return (
    <div
      className={
        embedded
          ? "space-y-8"
          : "container mx-auto max-w-7xl space-y-8 px-4 py-8"
      }
    >
      <div
        className={`flex flex-col gap-4 md:flex-row md:items-center md:justify-between ${
          embedded ? "" : "border-b pb-6"
        }`}
      >
        <div>
          <h1 className={`${embedded ? "text-2xl" : "text-3xl"} font-bold tracking-tight`}>
            {t("admin.moderation_page.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("admin.moderation_page.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select
            value={filter}
            onValueChange={(value: "all" | "banned" | "active") =>
              setFilter(value)
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue
                placeholder={t("admin.moderation_page.filter_placeholder")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("admin.moderation_page.filter_all")}
              </SelectItem>
              <SelectItem value="active">
                {t("admin.moderation_page.filter_active")}
              </SelectItem>
              <SelectItem value="banned">
                {t("admin.moderation_page.filter_banned")}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            title={t("admin.moderation_page.refresh")}
          >
            <Loader2 className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-muted">
              <CardHeader className="flex flex-col items-center pb-2">
                <Skeleton className="mb-4 h-24 w-24 rounded-full" />
                <Skeleton className="mb-2 h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 py-16 text-center">
          <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
          <h3 className="text-lg font-semibold text-destructive">
            {t("admin.moderation_page.error_title")}
          </h3>
          <p className="mb-6 max-w-sm text-muted-foreground">
            {t("admin.moderation_page.error_description")}
          </p>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <Loader2 className="h-4 w-4" /> {t("admin.moderation_page.try_again")}
          </Button>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-20 text-center">
          <UserIcon className="mb-4 h-16 w-16 text-muted-foreground/50" />
          <h3 className="text-xl font-semibold">
            {t("admin.moderation_page.no_users_found")}
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            {t("admin.moderation_page.no_users_matching")}
          </p>
          {filter !== "all" && (
            <Button
              variant="link"
              onClick={() => setFilter("all")}
              className="mt-4"
            >
              {t("admin.moderation_page.clear_filters")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {users.map((user) => {
            const isBanned = !!user.banned;

            return (
              <Card
                key={user.id}
                className="group flex flex-col overflow-hidden transition-all hover:border-primary/20 hover:shadow-lg"
              >
                <div className="absolute right-3 top-3 z-10">
                  <Badge
                    variant={isBanned ? "destructive" : "outline"}
                    className={
                      !isBanned
                        ? "border-green-200 bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400"
                        : ""
                    }
                  >
                    {isBanned
                      ? t("admin.moderation_page.status_banned")
                      : t("admin.moderation_page.status_active")}
                  </Badge>
                </div>

                <CardHeader className="relative flex flex-col items-center pb-2 pt-8 text-center">
                  <Avatar className="mb-3 h-28 w-28 border-4 border-background shadow-md transition-transform duration-300 group-hover:scale-105">
                    <AvatarImage
                      src={user.avatar_url}
                      alt={user.first_name}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary/5 text-3xl font-medium text-primary">
                      {user.first_name?.[0]?.toUpperCase()}
                      {user.last_name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <CardTitle className="w-full truncate px-2 text-lg font-bold">
                    {user.first_name} {user.last_name}
                  </CardTitle>

                  <div
                    className="flex max-w-full items-center gap-1.5 truncate px-4 text-sm text-muted-foreground"
                    title={user.email}
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-4 px-5 pb-4 pt-2">
                  <div className="min-h-[5rem] rounded-lg border border-muted/50 bg-muted/30 p-3 text-sm">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("admin.moderation_page.about_label")}
                    </span>
                    <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {user.bio || (
                        <span className="italic opacity-50">
                          {t("admin.moderation_page.no_bio")}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="mx-auto flex w-fit items-center justify-center gap-2 rounded-full bg-secondary/20 px-4 py-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {t("admin.moderation_page.since", {
                        date: formatCreatedAt(user.created_at),
                      })}
                    </span>
                  </div>
                </CardContent>

                <Separator />

                <CardFooter className="bg-muted/5 px-5 pb-5 pt-4">
                  <Button
                    variant={isBanned ? "outline" : "destructive"}
                    size="sm"
                    className="w-full gap-2 font-medium"
                    onClick={() => handleToggleBan(user.id, isBanned)}
                    disabled={isBanning}
                  >
                    {isBanned ? (
                      <>
                        <UserCheck className="h-4 w-4" />
                        {t("admin.moderation_page.unban_button")}
                      </>
                    ) : (
                      <>
                        <UserX className="h-4 w-4" />
                        {t("admin.moderation_page.ban_button")}
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center pb-12 pt-6">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="min-w-[200px] shadow-sm"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("common.loading")}
              </>
            ) : (
              t("admin.moderation_page.load_more")
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ModerationPage;
