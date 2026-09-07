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

export interface ProfileUserSummary {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  profilePhoto?: string;
}
