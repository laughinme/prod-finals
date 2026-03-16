import apiProtected from "../axiosInstance";

export interface BanUserResponseDto {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  bio: string;
  banned: boolean;
  created_at: Date;
  updated_at: Date;
}

export const banUser = async (
  userId: string,
  isBanned: boolean,
): Promise<BanUserResponseDto> => {
  const response = await apiProtected.post<BanUserResponseDto>(
    `admins/users/${userId}/ban`,
    {},
    {
      params: {
        banned: isBanned,
      },
    },
  );
  return response.data;
};
