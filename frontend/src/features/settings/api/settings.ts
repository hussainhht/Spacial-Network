import { apiRequest } from "@/lib/api/client";

interface ChangePasswordResponse {
  message: string;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiRequest<ChangePasswordResponse>("/users/me/password", {
    method: "PATCH",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}
