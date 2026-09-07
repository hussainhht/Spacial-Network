import Image from "next/image";
import { avatarUrl } from "../api/groups";
import type { Group } from "../types/group";

export default function GroupAvatar({
  group,
  size = 48,
}: {
  group: Pick<Group, "title" | "groupPhoto">;
  size?: number;
}) {
  if (group.groupPhoto) {
    return (
      <Image
        unoptimized
        src={avatarUrl(group.groupPhoto)!}
        alt=""
        width={size}
        height={size}
        className="group-emblem group-emblem-photo"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="group-emblem"
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      {group.title.charAt(0).toUpperCase()}
    </span>
  );
}
