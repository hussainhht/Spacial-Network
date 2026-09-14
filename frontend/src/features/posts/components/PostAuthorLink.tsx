"use client";

import Image from "next/image";
import Link from "next/link";
import { getBackendBaseUrl } from "@/lib/api";
import type { PostAuthor } from "@/features/posts/types/post";

interface PostAuthorLinkProps {
  author: PostAuthor;
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

export default function PostAuthorLink({ author }: PostAuthorLinkProps) {
  const fullName = [author.first_name, author.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <Link href={`/profile/${author.username}`} className="post-author">
      {author.profile_photo ? (
        <Image
          src={getFullPhotoUrl(author.profile_photo)}
          alt={`${author.username}'s avatar`}
          width={36}
          height={36}
          className="post-author-avatar"
        />
      ) : (
        <span className="post-author-avatar-fallback" aria-hidden="true">
          {getInitials(author.first_name, author.last_name, author.username)}
        </span>
      )}

      <span className="post-author-text">
        <span className="post-author-name">{fullName || author.username}</span>
        <span className="post-author-username">@{author.username}</span>
      </span>
    </Link>
  );
}
