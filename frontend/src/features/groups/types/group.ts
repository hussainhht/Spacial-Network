export interface Group {
  id: number;
  creatorId: number;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupInput {
  title: string;
  description: string;
}

export interface GroupMember {
  userId: number;
  username: string;
  role: string;
  joinedAt: string;
}

