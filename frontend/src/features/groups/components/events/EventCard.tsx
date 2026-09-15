"use client";

import { useState } from "react";
import { updateGroupEvent } from "../../hooks/useGroupData";
import EventAttendees from "./EventAttendees";
import { respondToGroupEvent } from "../../api/groups";
import { useGroupAction } from "../../hooks/useGroupAction";
import type { EventResponseStatus, GroupEvent } from "../../types/group";
import EventCountdown from "./EventCountdown";
import AppIcon from "@/components/layout/AppIcon";

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

function EventCover({ event }: { event: GroupEvent }) {
  const [failed, setFailed] = useState(false);
  if (!event.imageUrl || failed) {
    return <div className="group-event-cover group-event-cover-fallback" aria-label="Event cover placeholder"><AppIcon name="orbit" width={34} height={34} /></div>;
  }
  return (
    <div className="group-event-cover">
      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated backend upload URL */}
      <img src={event.imageUrl} alt="" onError={() => setFailed(true)} />
    </div>
  );
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
	  <EventCover event={event} />
	  <div className="group-event-details">
		<h3 className="group-event-title">{event.title}</h3>
		{event.description && <p className="group-event-description" title={event.description}>{event.description}</p>}
		<p className="group-event-time"><AppIcon name="calendar" width={16} height={16} /> {formatEventTime(event.eventTime)}</p>
		<EventCountdown eventTime={event.eventTime} />
		{creatorUsername && <p className="group-event-creator">Created by <strong>@{creatorUsername}</strong></p>}
	  </div>
      {isMember && (
		<div className="group-event-rsvp">
          <div
            className="group-event-attendee-actions"
            aria-label="Group responses"
          >
            {(["going", "not_going"] as const).map((status) => (
              <button
                key={status}
                type="button"
				className={`group-response-stat ${status}${currentResponse === status ? " is-selected" : ""}`}
                aria-expanded={openList === status}
                aria-controls={`event-${event.id}-attendees`}
                onClick={() => setOpenList(openList === status ? null : status)}
              >
				<span aria-hidden="true">{status === "going" ? "✓" : "×"}</span>
				<strong>{status === "going" ? event.goingCount : event.notGoingCount}</strong>
				<small>{status === "going" ? "Going" : "Not going"}</small>
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
		  <p className="group-event-response-label">{currentResponse ? `Your response: ${currentResponse === "going" ? "Going" : "Not going"}` : "Respond to this event"}</p>
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
			  ✓ Going
            </button>
            <button
              type="button"
              className={`group-response-btn${currentResponse === "not_going" ? " is-selected" : ""}`}
              disabled={Boolean(busy)}
              aria-pressed={currentResponse === "not_going"}
              onClick={() => void respond("not_going")}
            >
			  × Not going
            </button>
          </div>
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
