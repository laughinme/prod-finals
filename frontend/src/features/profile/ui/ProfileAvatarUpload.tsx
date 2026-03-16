import { useRef } from "react";
import { motion } from "motion/react";
import { IconCamera } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import {
    Avatar,
    AvatarImage,
    AvatarFallback,
} from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import { useSetDefaultAvatar, useUploadAvatar } from "@/features/profile";

interface ProfileAvatarUploadProps {
    src: string | null;
    fullName: string;
    email: string;
}

export function ProfileAvatarUpload({
    src,
    fullName,
    email,
}: ProfileAvatarUploadProps) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const { mutate: upload, isPending } = useUploadAvatar();
    const { mutate: setDefaultAvatar, isPending: isDefaultPending } = useSetDefaultAvatar();

    const initials = (fullName || email)
        .split(/[\s@]+/)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            upload(file);
        }
        e.target.value = "";
    };

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="relative group">
                <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => inputRef.current?.click()}
                    disabled={isPending || isDefaultPending}
                    className="relative z-10 rounded-full bg-background ring-4 ring-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
                >
                    <Avatar className="size-32 text-4xl sm:size-40 sm:text-5xl">
                        {src && <AvatarImage src={src} alt={fullName || email} />}
                        <AvatarFallback className="text-3xl font-medium sm:text-4xl">{initials}</AvatarFallback>
                    </Avatar>

                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <IconCamera className="size-6 text-white" />
                    </span>

                    {(isPending || isDefaultPending) && (
                        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                            <span className="size-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        </span>
                    )}
                </motion.button>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </div>

            {!src ? (
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setDefaultAvatar()}
                    disabled={isPending || isDefaultPending}
                    className="rounded-full px-4"
                >
                    {t("profile.set_default_photo")}
                </Button>
            ) : null}
        </div>
    );
}
