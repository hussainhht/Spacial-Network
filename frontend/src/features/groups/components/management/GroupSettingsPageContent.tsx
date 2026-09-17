"use client";

import Link from "next/link";
import AppIcon from "@/components/layout/AppIcon";
import { useGroupPageContext } from "../GroupDetailsContent";
import { GroupLoadError } from "../GroupPanels";
import EditGroupForm from "./EditGroupForm";
import styles from "./GroupSettings.module.css";

export default function GroupSettingsPageContent() {
  const { groupId, group, membership } = useGroupPageContext();

  if (membership.loading) {
    return (
      <div
        className={`${styles.settings} group-panel group-loading`}
        role="status"
      >
        Checking permissions…
      </div>
    );
  }
  if (membership.error) {
    return (
      <div className={styles.settings}>
        <GroupLoadError
          error={membership.error}
          retry={membership.refresh}
        />
      </div>
    );
  }
  if (membership.data?.role !== "creator") {
    return (
      <div className={styles.settings}>
        <Link href={`/groups/${groupId}`} className={styles.back}>
          <AppIcon name="arrowLeft" width={15} height={15} /> Back to Group
        </Link>
        <p className="form-error" role="alert">
          Only the group creator can manage these settings.
        </p>
      </div>
    );
  }

  return <EditGroupForm group={group} />;
}
