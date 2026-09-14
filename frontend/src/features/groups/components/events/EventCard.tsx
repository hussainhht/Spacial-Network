"use client";

import { useState } from "react";
import { updateGroupEvent } from "../../hooks/useGroupData";
import EventAttendees from "./EventAttendees";
import { respondToGroupEvent } from "../../api/groups";
import { useGroupAction } from "../../hooks/useGroupAction";
import type { EventResponseStatus, GroupEvent } from "../../types/group";
import EventCountdown from "./EventCountdown";

interface EventCardProps {
  event: GroupEvent;
  groupId: number;
  isMember: boolean;
  creatorUsername?: string;
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
}: EventCardProps) {
  const currentResponse = event.currentUserResponse;
  const [openList, setOpenList] = useState<EventResponseStatus | null>(null);
  const { busy, error, run } = useGroupAction(
    `event-response:${event.id}`,
    groupId,
  );

  async function respond(response: EventResponseStatus) {
    if (busy || currentResponse === response) return;
    await run("Updating…", async () => {
      const saved = await respondToGroupEvent(groupId, event.id, response);
      updateGroupEvent(saved);
    });
  }

  return (
    <article className="group-event-card">
      <h3 className="group-event-title">{event.title}</h3>
      <p className="group-event-time">{formatEventTime(event.eventTime)}</p>
      <EventCountdown eventTime={event.eventTime} />
      {event.description && (
        <p className="group-event-description">{event.description}</p>
      )}
      {creatorUsername && (
        <p className="group-event-creator">Created by @{creatorUsername}</p>
      )}
      {isMember && (
        <>
          <div
            className="group-event-attendee-actions"
            aria-label="Group responses"
          >
            {(["going", "not_going"] as const).map((status) => (
              <button
                key={status}
                type="button"
                className="group-response-btn"
                aria-expanded={openList === status}
                aria-controls={`event-${event.id}-attendees`}
                onClick={() => setOpenList(openList === status ? null : status)}
              >
                {status === "going"
                  ? `Going · ${event.goingCount}`
                  : `Not Going · ${event.notGoingCount}`}
              </button>
            ))}
          </div>
          {openList && (
            <EventAttendees
              groupId={groupId}
              eventId={event.id}
              status={openList}
            />
          )}
          <p className="group-muted group-event-response-label">
            Your response
          </p>
          <div
            className="group-event-response-actions"
            aria-busy={Boolean(busy)}
          >
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
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
