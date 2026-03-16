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

export default function ModerationPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<"all" | "banned" | "active">("all");

  const apiFilter = {
    banned: filter === "all" ? null : filter === "banned",
  };

  const queryResult = useModerationUsers(apiFilter);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = queryResult;

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
    <div className="container mx-auto py-8 px-4 space-y-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t("admin.moderation_page.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
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
            <SelectTrigger className="w-45">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-muted">
              <CardHeader className="pb-2 flex flex-col items-center">
                <Skeleton className="h-24 w-24 rounded-full mb-4" />
                <Skeleton className="h-6 w-3/4 mb-2" />
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
        <div className="flex flex-col items-center justify-center py-16 text-center bg-destructive/5 rounded-lg border border-destructive/20">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-semibold text-destructive">
            {t("admin.moderation_page.error_title")}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            {t("admin.moderation_page.error_description")}
          </p>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <Loader2 className="h-4 w-4" />{" "}
            {t("admin.moderation_page.try_again")}
          </Button>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border rounded-lg bg-muted/30 border-dashed">
          <UserIcon className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-semibold">
            {t("admin.moderation_page.no_users_found")}
          </h3>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {users.map((user) => (
            <Card
              key={user.id}
              className="flex flex-col overflow-hidden transition-all hover:shadow-lg hover:border-primary/20 group"
            >
              <div className="absolute top-3 right-3 z-10">
                <Badge
                  variant={user.banned ? "destructive" : "outline"}
                  className={
                    !user.banned
                      ? "bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/20 hover:text-green-700 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400"
                      : ""
                  }
                >
                  {user.banned
                    ? t("admin.moderation_page.status_banned")
                    : t("admin.moderation_page.status_active")}
                </Badge>
              </div>

              <CardHeader className="pb-2 pt-8 flex flex-col items-center text-center relative">
                <Avatar className="h-28 w-28 border-4 border-background shadow-md mb-3 group-hover:scale-105 transition-transform duration-300">
                  <AvatarImage
                    src={user.avatar_url}
                    alt={user.first_name}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-3xl bg-primary/5 text-primary font-medium">
                    {user.first_name?.[0]?.toUpperCase()}
                    {user.last_name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <CardTitle className="text-lg font-bold truncate w-full px-2">
                  {user.first_name} {user.last_name}
                </CardTitle>

                <div
                  className="flex items-center gap-1.5 text-sm text-muted-foreground truncate max-w-full px-4"
                  title={user.email}
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              </CardHeader>

              <CardContent className="flex-1 px-5 pb-4 pt-2 space-y-4">
                <div className="bg-muted/30 p-3 rounded-lg border border-muted/50 text-sm min-h-[5rem]">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                    {t("admin.moderation_page.about_label")}
                  </span>
                  <p className="line-clamp-3 text-muted-foreground leading-relaxed text-xs">
                    {user.bio || (
                      <span className="italic opacity-50">
                        {t("admin.moderation_page.no_bio")}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-secondary/20 py-2 rounded-full mx-auto w-fit px-4">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>
                    {t("admin.moderation_page.since", {
                      date: formatCreatedAt(user.created_at),
                    })}
                  </span>
                </div>
              </CardContent>

              <Separator />

              <CardFooter className="pt-4 pb-5 px-5 bg-muted/5">
                <Button
                  variant={user.banned ? "outline" : "destructive"}
                  size="sm"
                  className="w-full gap-2 font-medium"
                  onClick={() => handleToggleBan(user.id, user.banned)}
                  disabled={isBanning}
                >
                  {user.banned ? (
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
          ))}
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center pt-6 pb-12">
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
