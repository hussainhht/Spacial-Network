"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { resolveAvatarUrl } from "@/lib/avatar";
import styles from "./UserAvatar.module.css";

export type UserAvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizePixels: Record<UserAvatarSize, number> = {
  xs: 28,
  sm: 36,
  md: 42,
  lg: 52,
  xl: 72,
};

interface UserAvatarProps {
  src?: string | null;
  firstName?: string;
  lastName?: string;
  username?: string;
  name?: string;
  size?: UserAvatarSize | number;
  alt?: string;
  className?: string;
  priority?: boolean;
}

function avatarInitials({
  firstName,
  lastName,
  username,
  name,
}: Pick<UserAvatarProps, "firstName" | "lastName" | "username" | "name">) {
  const parts = [firstName, lastName].map((part) => part?.trim()).filter(Boolean) as string[];
  if (parts.length === 0 && name?.trim()) {
    parts.push(...name.trim().split(/\s+/).slice(0, 2));
  }
  if (parts.length > 0) return parts.map((part) => part[0]).join("").toUpperCase();
  return username?.trim().slice(0, 2).toUpperCase() ?? "";
}

export default function UserAvatar({
  src,
  firstName,
  lastName,
  username,
  name,
  size = "sm",
  alt,
  className = "",
  priority = false,
}: UserAvatarProps) {
  const imageUrl = resolveAvatarUrl(src);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = avatarInitials({ firstName, lastName, username, name });
  const pixels = typeof size === "number" ? size : sizePixels[size];
  const accessibleName = alt === undefined
    ? `${name?.trim() || [firstName, lastName].filter(Boolean).join(" ") || username || "User"} avatar`
    : alt;
  const showImage = Boolean(imageUrl) && failedUrl !== imageUrl;

  return (
    <span
      className={`${styles.avatar} ${className}`.trim()}
      style={{
        "--user-avatar-size": `${pixels}px`,
        borderRadius: "50%",
        clipPath: "circle(50% at 50% 50%)",
        aspectRatio: "1 / 1",
      } as CSSProperties}
      role={accessibleName ? "img" : undefined}
      aria-label={accessibleName || undefined}
    >
      {showImage ? (
        <Image
          unoptimized
          src={imageUrl!}
          alt=""
          aria-hidden="true"
          width={pixels}
          height={pixels}
          className={styles.image}
          style={{
            borderRadius: "50%",
            clipPath: "circle(50% at 50% 50%)",
            aspectRatio: "1 / 1",
            objectFit: "cover",
          }}
          onError={() => setFailedUrl(imageUrl!)}
          priority={priority}
        />
      ) : initials ? (
        <span className={styles.initials} aria-hidden="true">{initials}</span>
      ) : (
        <AppIcon className={styles.icon} name="user" aria-hidden="true" />
      )}
    </span>
  );
}
