"use client";

import { useEventResponses } from "../../hooks/useGroupData";
import type { EventResponseStatus } from "../../types/group";
import { GroupLoadError } from "../GroupPanels";

export default function EventAttendees({
  groupId,
  eventId,
  status,
}: {
  groupId: number;
  eventId: number;
  status: EventResponseStatus;
}) {
  // Only mounted, expanded panels request attendee data.
  const responses = useEventResponses(groupId, eventId);
  const users = responses.data?.filter((user) => user.response === status);
  return (
    <div
      className="group-event-attendees"
      id={`event-${eventId}-attendees`}
      aria-live="polite"
    >
      <h4>{status === "going" ? "Going" : "Not Going"}</h4>
      {responses.loading && !responses.data && (
        <p className="group-muted" role="status">
          Loading responses…
        </p>
      )}
      {responses.error && (
        <GroupLoadError error={responses.error} retry={responses.refresh} />
      )}
      {users?.length === 0 && <p className="group-muted">No responses yet</p>}
      {users && users.length > 0 && (
        <ul>
          {users.map((user) => (
            <li key={user.userId}>@{user.username}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
