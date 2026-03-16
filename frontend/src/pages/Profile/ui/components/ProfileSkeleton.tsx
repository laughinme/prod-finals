import { Skeleton } from "@/shared/components/ui/skeleton";

export function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
      <div className="flex items-center gap-6">
        <Skeleton className="size-24 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
    </div>
  );
}
