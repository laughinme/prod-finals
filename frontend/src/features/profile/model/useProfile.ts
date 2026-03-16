import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";

import { getProfile, patchProfile, uploadProfilePicture } from "@/shared/api/profile";
import type { UserPatchPayload } from "@/entities/user/model";

const PROFILE_KEY = ["profile", "me"] as const;

export function useProfile() {
    return useQuery({
        queryKey: PROFILE_KEY,
        queryFn: getProfile,
        staleTime: 1000 * 60 * 5,
        retry: 1,
    });
}

export function useUpdateProfile() {
    const qc = useQueryClient();
    const { t } = useTranslation();

    return useMutation({
        mutationFn: (data: UserPatchPayload) => patchProfile(data),
        onSuccess: (updated) => {
            qc.setQueryData(PROFILE_KEY, updated);
            toast.success(t("profile.update_success"));
        },
        onError: (error) => {
            Sentry.captureException(error);
            toast.error(t("profile.update_error"));
        },
    });
}

export function useUploadAvatar() {
    const qc = useQueryClient();
    const { t } = useTranslation();

    return useMutation({
        mutationFn: (file: File) => uploadProfilePicture(file),
        onSuccess: (updated) => {
            qc.setQueryData(PROFILE_KEY, updated);
            toast.success(t("profile.photo_update_success"));
        },
        onError: (error) => {
            Sentry.captureException(error);
            toast.error(t("profile.photo_upload_error"));
        },
    });
}
