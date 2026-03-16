import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/shared/components/ui/card";
import { useUpdateProfile } from "@/features/profile";
import type { User, UserPatchPayload } from "@/entities/user/model";

interface ProfileEditFormProps {
    profile: User;
}

export function ProfileEditForm({ profile }: ProfileEditFormProps) {
    const { t } = useTranslation();
    const [form, setForm] = useState<UserPatchPayload>({
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        bio: profile.bio ?? "",
        birthDate: profile.birthDate ?? "",
    });

    useEffect(() => {
        setForm({
            firstName: profile.firstName ?? "",
            lastName: profile.lastName ?? "",
            bio: profile.bio ?? "",
            birthDate: profile.birthDate ?? "",
        });
    }, [profile.firstName, profile.lastName, profile.bio, profile.birthDate]);

    const { mutate: save, isPending } = useUpdateProfile();

    const hasChanges =
        (form.bio ?? "") !== (profile.bio ?? "");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const payload: UserPatchPayload = {};
        if ((form.bio ?? "") !== (profile.bio ?? "")) {
            payload.bio = form.bio || null;
        }

        save(payload);
    };

    const handleReset = () => {
        setForm({
            firstName: profile.firstName ?? "",
            lastName: profile.lastName ?? "",
            bio: profile.bio ?? "",
            birthDate: profile.birthDate ?? "",
        });
    };

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="text-2xl">{t("profile.personal_info")}</CardTitle>
            </CardHeader>

            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-6 px-0 pb-6">
                    <div className="space-y-3">
                        <Label htmlFor="profile-first-name" className="text-sm font-semibold text-foreground/80">{t("profile.first_name")}</Label>
                        <Input
                            id="profile-first-name"
                            disabled
                            className="h-11 px-4 text-base bg-muted/60 border-border/30 text-muted-foreground cursor-not-allowed opacity-60"
                            value={form.firstName ?? ""}
                            readOnly
                        />
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="profile-last-name" className="text-sm font-semibold text-foreground/80">{t("profile.last_name")}</Label>
                        <Input
                            id="profile-last-name"
                            disabled
                            className="h-11 px-4 text-base bg-muted/60 border-border/30 text-muted-foreground cursor-not-allowed opacity-60"
                            value={form.lastName ?? ""}
                            readOnly
                        />
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="profile-age" className="text-sm font-semibold text-foreground/80">{t("profile.age")}</Label>
                        <Input
                            id="profile-age"
                            type="number"
                            disabled
                            className="h-11 px-4 text-base bg-muted/60 border-border/30 text-muted-foreground cursor-not-allowed opacity-60"
                            value={form.birthDate ? String(Math.floor((Date.now() - new Date(form.birthDate).getTime()) / 31557600000)) : ""}
                            readOnly
                        />
                    </div>

                    <div className="space-y-3">
                        <Label htmlFor="profile-bio" className="text-sm font-semibold text-foreground/80">{t("profile.bio")}</Label>
                        <textarea
                            id="profile-bio"
                            placeholder={t("profile.tell_about_yourself")}
                            rows={4}
                            className="w-full min-w-0 rounded-md border border-border/50 bg-muted/40 px-4 py-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-transparent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/20 resize-none"
                            value={form.bio ?? ""}
                            onChange={(e) =>
                                setForm((p) => ({ ...p, bio: e.target.value }))
                            }
                        />
                    </div>
                </CardContent>

                <CardFooter className="flex gap-3 justify-start px-0 pt-2 border-none">
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button
                            type="submit"
                            size="lg"
                            className="font-semibold"
                            disabled={!hasChanges || isPending}
                        >
                            {isPending ? t("common.saving") : t("common.save")}
                        </Button>
                    </motion.div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="lg"
                        disabled={!hasChanges || isPending}
                        onClick={handleReset}
                    >
                        {t("common.cancel")}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
