import apiProtected from "../axiosInstance";

export interface GetUsersRequestDto {
  banned: boolean | null;
  limit: number;
  cursor: string | null;
}

export interface GetUsersResponseDto {
  items: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    avatar_url: string;
    bio: string;
    banned: boolean;
    created_at: Date;
    updated_at: Date;
  }[];
}

export const getAllUsersAdmin = async (
  filter: GetUsersRequestDto,
): Promise<GetUsersResponseDto> => {
  const response = await apiProtected.get<GetUsersResponseDto>(
    "/admins/users/",
    {
      params: {
        banned: filter.banned,
        limit: filter.limit,
        cursor: filter.cursor,
      },
    },
  );
  return response.data;
};
