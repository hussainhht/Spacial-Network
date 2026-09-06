"use client";

import { respondToGroupEvent } from "../api/groups";
import { useGroupAction } from "../hooks/useGroupAction";
import type { EventResponseStatus, GroupEvent } from "../types/group";

interface EventCardProps {
  event: GroupEvent;
  groupId: number;
  isMember: boolean;
  creatorUsername?: string;
  currentResponse?: EventResponseStatus;
  onResponded: (eventId: number, response: EventResponseStatus) => void;
}

function formatEventTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function EventCard({
  event,
  groupId,
  isMember,
  creatorUsername,
  currentResponse,
  onResponded,
}: EventCardProps) {
  const { busy, error, run } = useGroupAction(
    `event-response:${event.id}`,
    groupId,
  );

  async function respond(response: EventResponseStatus) {
    if (busy || currentResponse === response) return;
    const ok = await run("Updating…", () =>
      respondToGroupEvent(groupId, event.id, response),
    );
    if (ok) onResponded(event.id, response);
  }

  return (
    <article className="group-event-card">
      <h3 className="group-event-title">{event.title}</h3>
      <p className="group-event-time">{formatEventTime(event.eventTime)}</p>
      {event.description && (
        <p className="group-event-description">{event.description}</p>
      )}
      {creatorUsername && (
        <p className="group-event-creator">Created by @{creatorUsername}</p>
      )}
      {isMember && (
        <div className="group-event-response-actions" aria-busy={Boolean(busy)}>
          <button
            type="button"
            className={`group-response-btn${currentResponse === "going" ? " is-selected" : ""}`}
            disabled={Boolean(busy)}
            aria-pressed={currentResponse === "going"}
            onClick={() => void respond("going")}
          >
            {currentResponse === "going" ? "✓ Going" : "Going"}
          </button>
          <button
            type="button"
            className={`group-response-btn${currentResponse === "not_going" ? " is-selected" : ""}`}
            disabled={Boolean(busy)}
            aria-pressed={currentResponse === "not_going"}
            onClick={() => void respond("not_going")}
          >
            {currentResponse === "not_going" ? "✓ Not Going" : "Not Going"}
          </button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
