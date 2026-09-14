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
        {isMember && (
          <button
            type="button"
            className="group-button secondary"
            onClick={() => setIsCreateOpen(true)}
          >
            + Create Event
          </button>
        )}
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
                isMember={isMember}
                creatorUsername={usernameById.get(event.createdBy)}
              />
            </li>
          ))}
        </ul>
      )}

      {isMember && isCreateOpen && (
        <CreateEventModal
          groupId={groupId}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </section>
  );
}
