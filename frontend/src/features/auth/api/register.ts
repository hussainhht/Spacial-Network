import { getApiBaseUrl } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";

export interface RegisterInput {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  gender: string;
  dateOfBirth: string;
  nickname?: string;
  aboutMe?: string;
  profilePhoto?: File | null;
}

export interface RegisterResult {
  message: string;
  userId?: string;
  profilePhotoUrl?: string;
}

interface RegisterResponseBody {
  success: boolean;
  message?: string;
  user_id?: string;
  profile_photo_url?: string;
}

// /register responds {success,message}, unlike the shared client's {error}
// envelope - same convention already used by features/groups/api and
// features/profile/api, so this mirrors their hand-rolled request helper
// instead of routing through lib/api/client's apiRequest.
export async function register(input: RegisterInput): Promise<RegisterResult> {
  const formData = new FormData();
  formData.append("username", input.username);
  formData.append("firstName", input.firstName);
  formData.append("lastName", input.lastName);
  formData.append("email", input.email);
  formData.append("password", input.password);
  formData.append("gender", input.gender);
  formData.append("dateOfBirth", input.dateOfBirth);
  if (input.nickname) formData.append("nickname", input.nickname);
  if (input.aboutMe) formData.append("aboutMe", input.aboutMe);
  if (input.profilePhoto) formData.append("profilePhoto", input.profilePhoto);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/register`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
  } catch {
    throw new ApiError("Could not connect to the server. Please try again.", 0);
  }

  let data: RegisterResponseBody;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "The server returned an unreadable response. Please try again.",
      response.status,
    );
  }

  if (!response.ok || !data.success) {
    throw new ApiError(data.message ?? "Registration failed", response.status);
  }

  return {
    message: data.message ?? "User registered successfully",
    userId: data.user_id,
    profilePhotoUrl: data.profile_photo_url,
  };
}
