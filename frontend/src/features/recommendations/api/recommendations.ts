import { apiRequest } from "@/lib/api/client";

export interface Recommendation {
  id: number;
  name: string;
  username: string;
  avatarUrl: string;
  mutualCount: number;
  mutualPreview: string[];
  isFollowing: boolean;
}

export async function getRecommendations(
  limit: 3 | 4 = 4,
): Promise<Recommendation[]> {
  return apiRequest<Recommendation[]>(
    "/users/recommendations?limit=" + String(limit),
    { method: "GET" },
  );
}
