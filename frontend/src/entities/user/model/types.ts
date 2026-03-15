export type User = {
    id: string;
    email: string;
    username: string | null;
    profilePicUrl: string | null;
    bio: string | null;
    birthDate: string | null;
    isOnboarded: boolean;
    quizStarted: boolean;
    banned: boolean;
    roles: string[];
    createdAt: string;
    updatedAt: string | null;
};

export type UserPatchPayload = {
    username?: string | null;
    bio?: string | null;
    birthDate?: string | null;
};
