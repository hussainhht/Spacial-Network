"use client";

import Image from "next/image";
import type { ProfileUserSummary } from "../types/profile";

interface ProfileUserListProps {
  title: string;
  users: ProfileUserSummary[];
  emptyMessage: string;
}

export default function ProfileUserList({
  title,
  users,
  emptyMessage,
}: ProfileUserListProps) {
  return (
    <section>
      <h2>{title}</h2>

      {users.length === 0 ? (
        <p>{emptyMessage}</p>
      ) : (
        <ul>
          {users.map((user) => (
            <li key={user.id}>
              {user.profilePhoto ? (
                <Image
                  src={`http://localhost:8080${user.profilePhoto}`}
                  alt={`${user.username}'s avatar`}
                  width={40}
                  height={40}
                />
              ) : null}

              <a href={`/profile/${user.username}`}>
                {user.firstName} {user.lastName} (@{user.username})
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
