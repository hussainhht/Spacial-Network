"use client";

import { useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { respondToGroupEvent } from "../../api/groups";
import { useGroupAction } from "../../hooks/useGroupAction";
import { updateGroupEvent } from "../../hooks/useGroupData";
import type { EventResponseStatus, GroupEvent } from "../../types/group";
import EventAttendees from "./EventAttendees";
import EventCountdown from "./EventCountdown";

interface EventCardProps {
  event: GroupEvent;
  groupId: number;
  isMember: boolean;
  isNextUp?: boolean;
  creatorUsername?: string;
}

function eventDateParts(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { month: "—", day: "—", year: "" };
  return {
    month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: date.toLocaleDateString(undefined, { day: "numeric" }),
    year: date.toLocaleDateString(undefined, { year: "numeric" }),
  };
}

function formatEventDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" });
}

function formatEventClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function EventCover({ event }: { event: GroupEvent }) {
  const [failed, setFailed] = useState(false);
  if (!event.imageUrl || failed) {
    return (
      <div className="group-event-cover group-event-cover-fallback" aria-hidden="true">
        <AppIcon name="orbit" width={34} height={34} />
      </div>
    );
  }
  return (
    <div className="group-event-cover">
      {/* eslint-disable-next-line @next/next/no-img-element -- mixed authenticated upload and local template URLs */}
      <img src={event.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
    </div>
  );
}

export default function EventCard({
  event,
  groupId,
  isMember,
  isNextUp = false,
  creatorUsername,
}: EventCardProps) {
  const currentResponse = event.currentUserResponse;
  const dateParts = eventDateParts(event.eventTime);
  const [openList, setOpenList] = useState<EventResponseStatus | null>(null);
  const { busy, error, run } = useGroupAction(`event-response:${event.id}`, groupId);

  async function respond(response: EventResponseStatus) {
    if (busy || currentResponse === response) return;
    await run("Updating response…", async () => {
      const saved = await respondToGroupEvent(groupId, event.id, response);
      updateGroupEvent(saved);
    });
  }

  return (
    <article className={`group-event-card${isNextUp ? " is-next-up" : ""}`}>
      <div className="group-event-card-main">
        <div className="group-event-date-block" aria-label={`${dateParts.month} ${dateParts.day}, ${dateParts.year}`}>
          <span>{dateParts.month}</span>
          <strong>{dateParts.day}</strong>
          <small>{dateParts.year}</small>
        </div>
        <EventCover event={event} />
        <div className="group-event-details">
          {isNextUp && <span className="group-event-next-badge">Next up</span>}
          <h3 className="group-event-title">{event.title}</h3>
          {event.description && <p className="group-event-description" title={event.description}>{event.description}</p>}
          <div className="group-event-meta">
            <p><AppIcon name="calendar" width={15} height={15} /> {formatEventDate(event.eventTime)} · {formatEventClock(event.eventTime)}</p>
            {creatorUsername && <p><AppIcon name="user" width={15} height={15} /> Created by <strong>@{creatorUsername}</strong></p>}
          </div>
          <EventCountdown eventTime={event.eventTime} />
        </div>
      </div>

      {isMember && (
        <div className="group-event-rsvp">
          <div className="group-event-attendee-actions" aria-label="Event response totals">
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

          <div className="group-event-response-choice">
            <p>{currentResponse ? `Your response: ${currentResponse === "going" ? "Going" : "Not going"}` : "Will you be there?"}</p>
            <div className="group-event-response-actions" aria-busy={Boolean(busy)}>
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

          {openList && <EventAttendees groupId={groupId} eventId={event.id} status={openList} />}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
      )}
    </article>
  );
}
