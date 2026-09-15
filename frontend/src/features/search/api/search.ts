import { getApiUrl } from "@/lib/api";
import type { SearchCategory, SearchResults } from "../types/search";

const EMPTY_RESULTS: SearchResults = {
  query: "",
  users: [],
  groups: [],
  posts: [],
  events: [],
};

export async function fetchSearchResults(
  query: string,
  type: SearchCategory = "all",
  limit = 10,
  signal?: AbortSignal,
): Promise<SearchResults> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ...EMPTY_RESULTS, query: "" };
  }

  const params = new URLSearchParams({
    q: trimmed,
    type: type === "shortcuts" ? "all" : type,
    limit: limit.toString(),
  });

  const response = await fetch(`${getApiUrl("/search")}?${params.toString()}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    if (response.status === 401) {
      return EMPTY_RESULTS;
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Search failed with status ${response.status}`);
  }

  const data: SearchResults = await response.json();
  return {
    query: data.query || trimmed,
    users: data.users || [],
    groups: data.groups || [],
    posts: data.posts || [],
    events: data.events || [],
  };
}
