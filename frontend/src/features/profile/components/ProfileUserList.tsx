"use client";

import UserAvatar from "@/components/UserAvatar";
import type { ProfileUserSummary } from "../types/profile";
import styles from "./Profile.module.css";

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
      <h3 className={styles.cardTitle}>{title}</h3>

      {users.length === 0 ? (
        <p className={styles.infoLabel}>{emptyMessage}</p>
      ) : (
        <ul className={styles.userList}>
          {users.map((user) => (
            <li key={user.id} className={styles.userListItem}>
              <UserAvatar
                src={user.profilePhoto}
                firstName={user.firstName}
                lastName={user.lastName}
                username={user.username}
                size={40}
                className={styles.userListAvatar}
              />

              <a
                href={`/profile/${user.username}`}
                className={styles.userListLink}
              >
                {user.firstName} {user.lastName} (@{user.username})
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
