import { useEffect, useMemo, useState } from "react";
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

const formatBirthDate = (value: string | null): string => {
    if (!value) {
        return "";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return parsed.toLocaleDateString("ru-RU");
};

const formatGender = (value: string | null, t: (key: string) => string): string => {
    if (!value) {
        return "";
    }

    if (value === "male") {
        return t("profile.gender_male");
    }
    if (value === "female") {
        return t("profile.gender_female");
    }
    return "";
};

export function ProfileEditForm({ profile }: ProfileEditFormProps) {
    const { t } = useTranslation();
    const [form, setForm] = useState<UserPatchPayload>({
        bio: profile.bio ?? "",
        city: profile.city?.name ?? "",
    });

    useEffect(() => {
        setForm({
            bio: profile.bio ?? "",
            city: profile.city?.name ?? "",
        });
    }, [profile.bio, profile.city?.name]);

    const { mutate: save, isPending } = useUpdateProfile();

    const bankHint = t("profile.bank_profile_hint");
    const normalizedCity = useMemo(() => (form.city ?? "").trim(), [form.city]);
    const normalizedBio = useMemo(() => (form.bio ?? "").trim(), [form.bio]);

    const hasChanges =
        normalizedBio !== (profile.bio ?? "").trim() ||
        normalizedCity !== (profile.city?.name ?? "").trim();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const payload: UserPatchPayload = {};
        if (normalizedBio !== (profile.bio ?? "").trim()) {
            payload.bio = normalizedBio || null;
        }
        if (normalizedCity !== (profile.city?.name ?? "").trim()) {
            payload.city = normalizedCity || null;
        }

        save(payload);
    };

    const handleReset = () => {
        setForm({
            bio: profile.bio ?? "",
            city: profile.city?.name ?? "",
        });
    };

    return (
        <Card className="border-none bg-transparent shadow-none">
            <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="text-2xl">{t("profile.personal_info")}</CardTitle>
            </CardHeader>

            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-6 px-0 pb-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <ReadOnlyField
                            id="profile-first-name"
                            label={t("profile.first_name")}
                            value={profile.firstName ?? ""}
                            hint={bankHint}
                        />
                        <ReadOnlyField
                            id="profile-last-name"
                            label={t("profile.last_name")}
                            value={profile.lastName ?? ""}
                            hint={bankHint}
                        />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <ReadOnlyField
                            id="profile-birth-date"
                            label={t("profile.birth_date")}
                            value={formatBirthDate(profile.birthDate)}
                            hint={bankHint}
                        />
                        <ReadOnlyField
                            id="profile-gender"
                            label={t("profile.gender")}
                            value={formatGender(profile.gender, t)}
                            hint={bankHint}
                        />
                    </div>

                    <div className="space-y-3">
                        <Label
                            htmlFor="profile-city"
                            className="text-sm font-semibold text-foreground/80"
                        >
                            {t("profile.city")}
                        </Label>
                        <Input
                            id="profile-city"
                            className="h-11 px-4 text-base"
                            placeholder={t("profile.city_hint")}
                            value={form.city ?? ""}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, city: e.target.value }))
                            }
                        />
                    </div>

                    <div className="space-y-3">
                        <Label
                            htmlFor="profile-bio"
                            className="text-sm font-semibold text-foreground/80"
                        >
                            {t("profile.bio")}
                        </Label>
                        <textarea
                            id="profile-bio"
                            placeholder={t("profile.tell_about_yourself")}
                            rows={4}
                            className="w-full min-w-0 resize-none rounded-md border border-border/50 bg-muted/40 px-4 py-3 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-transparent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/20"
                            value={form.bio ?? ""}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, bio: e.target.value }))
                            }
                        />
                    </div>
                </CardContent>

                <CardFooter className="flex justify-start gap-3 border-none px-0 pt-2">
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

function ReadOnlyField({
    id,
    label,
    value,
    hint,
}: {
    id: string;
    label: string;
    value: string;
    hint: string;
}) {
    return (
        <div className="space-y-3">
            <Label htmlFor={id} className="text-sm font-semibold text-foreground/80">
                {label}
            </Label>
            <div className="space-y-2">
                <Input
                    id={id}
                    disabled
                    className="h-11 cursor-not-allowed border-border/30 bg-muted/60 px-4 text-base text-muted-foreground opacity-70"
                    value={value}
                    readOnly
                />
                <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
        </div>
    );
}
