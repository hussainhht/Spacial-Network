"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getBackendBaseUrl } from "@/lib/api";
import type { PostAuthor } from "@/features/posts/types/post";
import styles from "./PostAuthorLink.module.css";

interface PostAuthorLinkProps {
  author: PostAuthor;
  disabled?: boolean;
  meta?: ReactNode;
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

export default function PostAuthorLink({ author, disabled = false, meta }: PostAuthorLinkProps) {
  const fullName = [author.first_name, author.last_name]
    .filter(Boolean)
    .join(" ");

  const avatar = (
    <>
      {author.profile_photo ? (
        <Image
          src={getFullPhotoUrl(author.profile_photo)}
          alt=""
          width={40}
          height={40}
          className={styles.avatar}
        />
      ) : (
        <span className={styles.avatarFallback} aria-hidden="true">
          {getInitials(author.first_name, author.last_name, author.username)}
        </span>
      )}
    </>
  );

  return (
    <div className={styles.author}>
      {disabled ? (
        <span>{avatar}</span>
      ) : (
        <Link
          href={`/profile/${author.username}`}
          className={styles.avatarLink}
          aria-label={`View ${fullName || author.username}'s profile`}
        >
          {avatar}
        </Link>
      )}
      <div className={styles.text}>
        {disabled ? (
          <span className={styles.name}>{fullName || author.username}</span>
        ) : (
          <Link href={`/profile/${author.username}`} className={styles.name}>
            {fullName || author.username}
          </Link>
        )}
        <div className={styles.meta}>
          {disabled ? (
            <span className={styles.username}>@{author.username}</span>
          ) : (
            <Link href={`/profile/${author.username}`} className={styles.username}>
              @{author.username}
            </Link>
          )}
          {meta}
        </div>
      </div>
    </div>
  );
}
