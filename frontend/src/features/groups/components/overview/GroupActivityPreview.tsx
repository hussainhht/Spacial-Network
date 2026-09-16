import UserAvatar from "@/components/UserAvatar";
import { formatDate } from "@/lib/utils";
import type { Group, GroupMember } from "../../types/group";

interface GroupActivityPreviewProps {
  group: Group;
  members?: GroupMember[];
}

// Built entirely from the group's own record (creator + creation date) plus
// the already-loaded members list for the creator's avatar - no dedicated
// activity feed exists on the backend, so this stays a single safe entry
// rather than inventing history that was never recorded.
export default function GroupActivityPreview({
  group,
  members,
}: GroupActivityPreviewProps) {
  const creator = members?.find((member) => member.userId === group.creatorId);

  return (
    <section
      className="group-panel group-activity"
      aria-labelledby="activity-heading"
    >
      <div className="group-section-heading">
        <h2 id="activity-heading">Recent Activity</h2>
      </div>
      <div className="group-activity-item">
        <UserAvatar
          src={creator?.avatar}
          username={group.creatorUsername}
          size={32}
          alt=""
          className="group-member-avatar"
        />
        <div className="group-activity-text">
          <p>
            <span className="group-title-link">@{group.creatorUsername}</span>{" "}
            created the group
          </p>
          <span className="group-muted-inline">
            {formatDate(group.createdAt)}
          </span>
        </div>
      </div>
    </section>
  );
}
