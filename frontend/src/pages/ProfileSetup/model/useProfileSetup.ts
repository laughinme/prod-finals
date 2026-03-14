import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as Sentry from "@sentry/react";

import type { MatchmakingDraft } from "@/entities/match-profile/model";
import { useMatchmakingFlow } from "@/features/matchmaking/model";
import {
  useProfile,
  useUpdateProfile,
  useUploadAvatar,
} from "@/features/profile/useProfile";

export function useProfileSetup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { draft, setDraft, completeOnboarding } = useMatchmakingFlow();
  const { data: profile } = useProfile();
  const { mutateAsync: updateProfile, isPending: isUpdatingProfile } =
    useUpdateProfile();
  const { mutateAsync: uploadAvatar, isPending: isUploadingAvatar } =
    useUploadAvatar();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [photoUploaded, setPhotoUploaded] = useState(
    draft.photoUploaded || Boolean(profile?.profilePicUrl),
  );
  const [name, setName] = useState(draft.name || profile?.username || "");
  const [age, setAge] = useState(draft.age);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    draft.interests,
  );
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(
    null,
  );
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    profile?.profilePicUrl ?? null,
  );
  const [step1Error, setStep1Error] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }

    if (!name.trim() && profile.username) {
      setName(profile.username);
    }

    if (!avatarPreview && profile.profilePicUrl) {
      setAvatarPreview(profile.profilePicUrl);
    }

    if (profile.profilePicUrl) {
      setPhotoUploaded(true);
    }
  }, [avatarPreview, name, profile]);

  useEffect(() => {
    setDraft({
      photoUploaded,
      name,
      age,
      interests: selectedInterests,
    });
  }, [age, name, photoUploaded, selectedInterests, setDraft]);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const isStep1Valid =
    photoUploaded && name.trim().length > 1 && age.trim().length > 0;
  const isStep2Valid = selectedInterests.length >= 3;
  const isSubmittingStep1 = isUpdatingProfile || isUploadingAvatar;

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests((prevInterests) =>
        prevInterests.filter((item) => item !== interest),
      );
      return;
    }

    if (selectedInterests.length < 5) {
      setSelectedInterests((prevInterests) => [...prevInterests, interest]);
    }
  };

  const handleAvatarSelection = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (avatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }

    setSelectedAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setPhotoUploaded(true);
    setStep1Error(null);
    event.target.value = "";
  };

  const handleStep1Submit = async () => {
    if (!isStep1Valid || isSubmittingStep1) {
      return;
    }

    setStep1Error(null);

    try {
      if (name.trim() !== (profile?.username ?? "")) {
        await updateProfile({ username: name.trim() || null });
      }

      if (selectedAvatarFile) {
        await uploadAvatar(selectedAvatarFile);
        setSelectedAvatarFile(null);
      }

      setStep(2);
    } catch (error) {
      Sentry.captureException(error);
      setStep1Error(t("profile.save_error"));
    }
  };

  const handleComplete = () => {
    const nextDraft: MatchmakingDraft = {
      ...draft,
      photoUploaded,
      name,
      age,
      interests: selectedInterests,
    };

    completeOnboarding(nextDraft);
    navigate("/discovery", { replace: true });
  };

  return {
    profile,
    step,
    photoUploaded,
    name,
    age,
    selectedInterests,
    avatarPreview,
    step1Error,
    fileInputRef,
    isStep1Valid,
    isStep2Valid,
    isSubmittingStep1,
    avatarUploadStatusLabel: selectedAvatarFile
      ? t("profile.ready_to_upload")
      : t("profile.uploaded"),
    setName,
    setAge,
    setStep,
    toggleInterest,
    handleAvatarSelection,
    handleStep1Submit,
    handleComplete,
  };
}
