import apiProtected from "../axiosInstance";

export interface GetUsersRequestDto {
  banned: boolean | null;
  limit: number;
  cursor: string | null;
}

export interface GetUsersItemDto {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  banned: boolean;
  created_at: string;
  updated_at: string;
}

export interface GetUsersResponseDto {
  items: GetUsersItemDto[];
  next_cursor: string | null;
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
