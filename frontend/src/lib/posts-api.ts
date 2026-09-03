// Client for the Go backend's Posts API (see backend/internal/posts).
// All requests are sent with credentials so the session cookie set by
// /api/login is included.

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

export interface Post {
  id: number;
  user_id: number;
  private: boolean;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_owner: boolean;
}

export interface PostInput {
  title: string;
  content: string;
  private: boolean;
}

export class PostsApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PostsApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    throw new PostsApiError("Could not connect to server", 0);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      // response had no JSON body
    }
    throw new PostsApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function listPosts(): Promise<Post[]> {
  return request<Post[]>("/posts");
}

export function getPost(id: number): Promise<Post> {
  return request<Post>(`/posts/${id}`);
}

export function createPost(input: PostInput): Promise<void> {
  return request<void>("/posts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePost(id: number, input: PostInput): Promise<void> {
  return request<void>(`/posts/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deletePost(id: number): Promise<void> {
  return request<void>(`/posts/${id}`, {
    method: "DELETE",
  });
}
