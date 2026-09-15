"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import AppIcon from "@/components/layout/AppIcon";
import { useGroup, useMembership } from "../../hooks/useGroupData";
import { GroupLoadError } from "../GroupPanels";
import EditGroupForm from "./EditGroupForm";
import styles from "./GroupSettings.module.css";

export default function GroupSettingsPageContent() {
  const { groupId } = useParams<{ groupId: string }>();
  const id = Number(groupId);

  if (!/^[1-9]\d*$/.test(groupId) || !Number.isSafeInteger(id)) {
    return (
      <div className={styles.settings}>
        <Link href="/groups" className={styles.back}>
          <AppIcon name="arrowLeft" width={15} height={15} /> Back to groups
        </Link>
        <p className="form-error" role="alert">Invalid group ID. Choose a group from the directory.</p>
      </div>
    );
  }

  return <LoadedSettings key={id} groupId={id} />;
}

function LoadedSettings({ groupId }: { groupId: number }) {
  const group = useGroup(groupId);
  const membership = useMembership(groupId);

  if (group.loading && !group.data) return <div className={`${styles.settings} group-panel group-loading`} role="status">Loading settings…</div>;
  if (group.error) return <div className={styles.settings}><GroupLoadError error={group.error} retry={group.refresh} /></div>;
  if (membership.loading) return <div className={`${styles.settings} group-panel group-loading`} role="status">Checking permissions…</div>;
  if (membership.error) return <div className={styles.settings}><GroupLoadError error={membership.error} retry={membership.refresh} /></div>;
  if (!group.data || membership.data?.role !== "creator") {
    return (
      <div className={styles.settings}>
        <Link href={`/groups/${groupId}`} className={styles.back}><AppIcon name="arrowLeft" width={15} height={15} /> Back to Group</Link>
        <p className="form-error" role="alert">Only the group creator can manage these settings.</p>
      </div>
    );
  }

  return <EditGroupForm group={group.data} />;
}
