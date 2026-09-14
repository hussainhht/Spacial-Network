"use client";

import { useMemo, useState } from "react";
import { useGroupEvents } from "../../hooks/useGroupData";
import type { GroupEvent, GroupMember } from "../../types/group";
import CreateEventModal from "./CreateEventModal";
import EventCard from "./EventCard";
import { GroupLoadError } from "../GroupPanels";

interface GroupEventsProps {
  groupId: number;
  isMember: boolean;
  members?: GroupMember[];
}

export default function GroupEvents({
  groupId,
  isMember,
  members,
}: GroupEventsProps) {
  if (!isMember) {
    return (
      <section className="group-panel group-member-only" aria-labelledby="events-heading">
        <span className="group-member-only-icon" aria-hidden="true">🔒</span>
        <h2 id="events-heading">Group events are member-only</h2>
        <p className="group-muted">Join this group to see upcoming events and activities.</p>
      </section>
    );
  }

  return <MemberGroupEvents groupId={groupId} members={members} />;
}

function MemberGroupEvents({
  groupId,
  members,
}: Omit<GroupEventsProps, "isMember">) {
  const events = useGroupEvents(groupId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const usernameById = useMemo(() => {
    const map = new Map<number, string>();
    members?.forEach((member) => map.set(member.userId, member.username));
    return map;
  }, [members]);

  return (
    <section
      className="group-panel group-events"
      aria-labelledby="events-heading"
    >
      <div className="group-section-heading">
        <h2 id="events-heading">Events</h2>
        <button
          type="button"
          className="group-button secondary"
          onClick={() => setIsCreateOpen(true)}
        >
          + Create Event
        </button>
      </div>
      <p className="group-muted">Upcoming events and group activities.</p>

      {events.loading && !events.data && (
        <p className="group-muted" role="status">
          Loading events...
        </p>
      )}

      {events.error && (
        <GroupLoadError error={events.error} retry={events.refresh} />
      )}

      {!events.loading && !events.error && events.data?.length === 0 && (
        <div className="group-empty">
          <h3>No events yet</h3>
          <p>Create the first event for this group.</p>
        </div>
      )}

      {events.data && events.data.length > 0 && (
        <ul className="group-events-list">
          {events.data.map((event: GroupEvent) => (
            <li key={event.id}>
              <EventCard
                event={event}
                groupId={groupId}
                isMember
                creatorUsername={usernameById.get(event.createdBy)}
              />
            </li>
          ))}
        </ul>
      )}

      {isCreateOpen && (
        <CreateEventModal
          groupId={groupId}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </section>
  );
}
