"use client";

import Image from "next/image";
import { getBackendBaseUrl } from "@/lib/api";
import type { ProfileUserSummary } from "../types/profile";
import styles from "./Profile.module.css";

interface ProfileUserListProps {
  title: string;
  users: ProfileUserSummary[];
  emptyMessage: string;
}

function getFullPhotoUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${getBackendBaseUrl()}${cleanPath}`;
}

function getInitials(firstName: string, lastName: string, username: string) {
  const initials = `${firstName ? firstName[0] : ""}${lastName ? lastName[0] : ""}`
    .trim()
    .toUpperCase();
  return initials || username.slice(0, 2).toUpperCase();
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
              {user.profilePhoto ? (
                <Image
                  src={getFullPhotoUrl(user.profilePhoto)}
                  alt={`${user.username}'s avatar`}
                  width={40}
                  height={40}
                  className={styles.userListAvatar}
                />
              ) : (
                <span className={styles.userListAvatarFallback}>
                  {getInitials(user.firstName, user.lastName, user.username)}
                </span>
              )}

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
