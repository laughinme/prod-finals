export type User = {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string;
    profilePicUrl: string | null;
    bio: string | null;
    birthDate: string | null;
    lookingForGenders: string[];
    ageRange: { min: number; max: number } | null;
    interests: string[];
    importTransactions: boolean;
    isOnboarded: boolean;
    quizStarted: boolean;
    banned: boolean;
    roles: string[];
    createdAt: string;
    updatedAt: string | null;
};

export type UserPatchPayload = {
    firstName?: string | null;
    lastName?: string | null;
    bio?: string | null;
    birthDate?: string | null;
    lookingForGenders?: string[] | null;
    ageRange?: { min: number; max: number } | null;
    interests?: string[] | null;
    importTransactions?: boolean | null;
};
