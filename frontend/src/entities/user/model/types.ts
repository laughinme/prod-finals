export type User = {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string;
    profilePicUrl: string | null;
    bio: string | null;
    birthDate: string | null;
    gender: string | null;
    city: { id: string; name: string } | null;
    goal: string | null;
    lookingForGenders: string[];
    ageRange: { min: number; max: number } | null;
    distanceKm: number | null;
    interests: string[];
    importTransactions: boolean;
    isOnboarded: boolean;
    quizStarted: boolean;
    hasApprovedPhoto: boolean;
    canLikeProfiles: boolean;
    canBeShownInFeed: boolean;
    banned: boolean;
    roles: string[];
    createdAt: string;
    updatedAt: string | null;
};

export type UserPatchPayload = {
    bio?: string | null;
    cityId?: string | null;
    city?: string | null;
    goal?: string | null;
    lookingForGenders?: string[] | null;
    ageRange?: { min: number; max: number } | null;
    distanceKm?: number | null;
    interests?: string[] | null;
    importTransactions?: boolean | null;
};
