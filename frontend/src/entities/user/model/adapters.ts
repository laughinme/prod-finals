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
    isOnboarded: dto.is_onboarded,
    quizStarted: dto.quiz_started,
    banned: dto.banned,
    roles: dto.role_slugs ?? dto.roles ?? [],
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
});

export const toUserPatchDto = (patch: UserPatchPayload): UserPatchPayloadDto => {
    const dto: UserPatchPayloadDto = {};
    if (patch.firstName !== undefined) dto.first_name = patch.firstName;
    if (patch.lastName !== undefined) dto.last_name = patch.lastName;
    if (patch.bio !== undefined) dto.bio = patch.bio;
    if (patch.birthDate !== undefined) dto.birth_date = patch.birthDate;
    return dto;
};
