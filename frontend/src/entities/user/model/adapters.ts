import type { UserDto, UserPatchPayloadDto } from "@/shared/api/profile";
import type { User, UserPatchPayload } from "./types";

export const toUser = (dto: UserDto): User => ({
    id: dto.id,
    email: dto.email,
    firstName: dto.first_name ?? null,
    lastName: dto.last_name ?? null,
    fullName: [dto.first_name, dto.last_name].filter(Boolean).join(" ").trim() || dto.email,
    profilePicUrl: dto.avatar_url ?? dto.profile_pic_url ?? null,
    bio: dto.bio ?? null,
    birthDate: dto.birth_date ?? null,
    gender: dto.gender ?? null,
    city: dto.city ?? null,
    goal: dto.goal ?? null,
    lookingForGenders: dto.looking_for_genders ?? [],
    ageRange: dto.age_range ?? null,
    distanceKm: dto.distance_km ?? null,
    interests: dto.interests ?? [],
    importTransactions: dto.import_transactions ?? true,
    isOnboarded: dto.is_onboarded,
    quizStarted: dto.quiz_started,
    hasApprovedPhoto: dto.has_approved_photo ?? false,
    canLikeProfiles: dto.can_like_profiles ?? false,
    canBeShownInFeed: dto.can_be_shown_in_feed ?? false,
    banned: dto.banned,
    roles: dto.role_slugs ?? dto.roles ?? [],
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
});

export const toUserPatchDto = (patch: UserPatchPayload): UserPatchPayloadDto => {
    const dto: UserPatchPayloadDto = {};
    if (patch.bio !== undefined) dto.bio = patch.bio;
    if (patch.cityId !== undefined) dto.city_id = patch.cityId;
    if (patch.city !== undefined) dto.city = patch.city;
    if (patch.goal !== undefined) dto.goal = patch.goal;
    if (patch.lookingForGenders !== undefined) dto.looking_for_genders = patch.lookingForGenders;
    if (patch.ageRange !== undefined) dto.age_range = patch.ageRange;
    if (patch.distanceKm !== undefined) dto.distance_km = patch.distanceKm;
    if (patch.interests !== undefined) dto.interests = patch.interests;
    if (patch.importTransactions !== undefined) dto.import_transactions = patch.importTransactions;
    return dto;
};
