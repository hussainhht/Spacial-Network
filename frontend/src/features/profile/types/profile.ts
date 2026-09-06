export interface Profile {
  id: number;
  uuid: string;
  username: string;
  age: number;
  gender: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePhoto?: string;
  createdAt: string;
  updatedAt: string;
  isPrivate: boolean;
}

export type ProfileTab = "posts" | "about";
