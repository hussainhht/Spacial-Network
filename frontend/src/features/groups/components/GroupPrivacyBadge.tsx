import AppIcon from "@/components/layout/AppIcon";
import type { GroupPrivacy } from "../types/group";
import styles from "./GroupPrivacyBadge.module.css";

export default function GroupPrivacyBadge({
  privacy,
  detailed = false,
}: {
  privacy: GroupPrivacy;
  detailed?: boolean;
}) {
  const isPublic = privacy === "public";

  return (
    <span className={styles.badge} data-privacy={privacy}>
      <AppIcon name={isPublic ? "globe" : "lock"} width={14} height={14} />
      {isPublic
        ? detailed
          ? "Public Group"
          : "Public"
        : detailed
          ? "Private Group"
          : "Private"}
    </span>
  );
}
