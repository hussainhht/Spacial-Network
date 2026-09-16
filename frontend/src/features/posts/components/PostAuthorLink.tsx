"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import UserAvatar from "@/components/UserAvatar";
import type { PostAuthor } from "@/features/posts/types/post";
import styles from "./PostAuthorLink.module.css";

interface PostAuthorLinkProps {
  author: PostAuthor;
  disabled?: boolean;
  prominent?: boolean;
  meta?: ReactNode;
}

export default function PostAuthorLink({ author, disabled = false, prominent = false, meta }: PostAuthorLinkProps) {
  const fullName = [author.first_name, author.last_name]
    .filter(Boolean)
    .join(" ");

  const avatar = (
    <UserAvatar
      src={author.profile_photo}
      firstName={author.first_name}
      lastName={author.last_name}
      username={author.username}
      size={prominent ? 48 : 40}
      alt=""
      className={styles.avatar}
    />
  );

  return (
    <div className={`${styles.author} ${prominent ? styles.prominent : ""}`}>
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
