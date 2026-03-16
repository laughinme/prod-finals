import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getAdminRandomMixConfig,
  type RandomMixConfigDto,
  updateAdminRandomMixConfig,
} from "@/shared/api/admin";

const QUERY_KEY = ["admin", "experiments", "random-mix"] as const;

function normalizeRandomMixPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.round(value);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 80) {
    return 80;
  }
  return rounded;
}

export function useAdminRandomMixSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getAdminRandomMixConfig,
    staleTime: 1000 * 30,
  });
  const [draftPercent, setDraftPercent] = useState(0);

  useEffect(() => {
    if (!query.data) {
      return;
    }
    setDraftPercent(normalizeRandomMixPercent(query.data.random_mix_percent));
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: async (nextPercent: number) =>
      updateAdminRandomMixConfig(normalizeRandomMixPercent(nextPercent)),
    onSuccess: (data: RandomMixConfigDto) => {
      queryClient.setQueryData(QUERY_KEY, data);
      toast.success("Настройка random mix сохранена");
    },
    onError: () => {
      toast.error("Не удалось сохранить настройку random mix");
    },
  });

  const savedPercent = normalizeRandomMixPercent(query.data?.random_mix_percent ?? 0);
  const isDirty = useMemo(
    () => normalizeRandomMixPercent(draftPercent) !== savedPercent,
    [draftPercent, savedPercent],
  );

  return {
    randomMixPercent: savedPercent,
    draftPercent: normalizeRandomMixPercent(draftPercent),
    setDraftPercent,
    updatedAt: query.data?.updated_at ?? null,
    isLoading: query.isPending,
    isError: query.isError,
    isSaving: mutation.isPending,
    isDirty,
    save: async () => mutation.mutateAsync(draftPercent),
  };
}
