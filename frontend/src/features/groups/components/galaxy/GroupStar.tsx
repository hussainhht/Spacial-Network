import type { CSSProperties } from "react";
import type { OrbitPosition } from "../../utils/orbitLayout";
import { ORBITS } from "../../utils/orbitLayout";
import GroupAvatar from "../GroupAvatar";
import { MembershipBadge } from "../GroupPanels";
import styles from "./GroupGalaxy.module.css";

export default function GroupStar({
  position: { group, ring, angle },
  selected,
  dimmed = false,
  matching = true,
  onSelect,
}: {
  position: OrbitPosition;
  selected: boolean;
  dimmed?: boolean;
  matching?: boolean;
  onSelect: () => void;
}) {
  return (
    <li
      className={styles.arm}
      style={
        {
          "--angle": `${angle}deg`,
          "--radius": `${ORBITS[ring].radius}%`,
        } as CSSProperties
      }
      data-selected={selected}
      data-dimmed={dimmed}
      data-matching={matching}
    >
      <div className={styles.anchor}>
        <div className={styles.angleCorrection}>
          <div className={styles.upright} data-counter-orbit={ring}>
            {/* Three transform writers, three elements: the ring rotation owns
                `.upright` above, the entrance owns this wrapper, and hover and
                selection own `.planet` inside the button. None of them can ever
                overwrite another's transform. */}
            <div
              className={styles.emergence}
              data-universe-node
              data-universe-emerge={ring}
            >
              <button
                type="button"
                id={`group-star-${group.id}`}
                className={styles.star}
                aria-label={`Open preview for ${group.title}`}
                aria-describedby={`group-status-${group.id}`}
                aria-pressed={selected}
                aria-controls={selected ? "group-preview" : undefined}
                onClick={onSelect}
              >
                <span className={styles.planet}>
                  <GroupAvatar group={group} size={56} />
                </span>
                <span className={styles.starName}>{group.title}</span>
                <span
                  className={styles.tooltip}
                  id={`group-status-${group.id}`}
                >
                  <MembershipBadge
                    role={group.membershipRole}
                    invited={group.hasPendingInvitation}
                    pending={group.hasPendingJoinRequest}
                  />
                  <span>{group.title}</span>
                  <span>
                    {group.memberCount}{" "}
                    {group.memberCount === 1 ? "member" : "members"}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
