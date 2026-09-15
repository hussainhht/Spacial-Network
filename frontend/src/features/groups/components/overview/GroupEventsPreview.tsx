"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/utils";
import CreateEventModal from "../events/CreateEventModal";
import { useGroupEvents } from "../../hooks/useGroupData";
import { GroupLoadError } from "../GroupPanels";

const PREVIEW_COUNT = 3;

interface GroupEventsPreviewProps {
  groupId: number;
  isMember: boolean;
  onSeeAll: () => void;
}

// Reads the same cached `useGroupEvents` resource as the Events tab, so
// switching tabs never triggers a second events request.
export default function GroupEventsPreview({
  groupId,
  isMember,
  onSeeAll,
}: GroupEventsPreviewProps) {
  const events = useGroupEvents(groupId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [now] = useState(Date.now);

  const upcoming = useMemo(() => {
    if (!events.data) return undefined;
    return events.data
      .filter((event) => new Date(event.eventTime).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime(),
      )
      .slice(0, PREVIEW_COUNT);
  }, [events.data, now]);

  if (!isMember) {
    return (
      <section
        className="group-panel group-events-preview"
        aria-labelledby="events-preview-heading"
      >
        <div className="group-section-heading">
          <h2 id="events-preview-heading">Upcoming Events</h2>
        </div>
        <p className="group-muted">
          Join this group to see upcoming events and activities.
        </p>
      </section>
    );
  }

  return (
    <section
      className="group-panel group-events-preview"
      aria-labelledby="events-preview-heading"
    >
      <div className="group-section-heading">
        <h2 id="events-preview-heading">Upcoming Events</h2>
        <button
          type="button"
          className="group-see-all"
          onClick={() => setIsCreateOpen(true)}
        >
          Create Event
        </button>
      </div>

      {events.error && (
        <GroupLoadError error={events.error} retry={events.refresh} />
      )}

      {!events.data && events.loading && (
        <p className="group-muted">Loading events…</p>
      )}

      {upcoming && upcoming.length === 0 && (
        <div className="group-empty group-events-preview-empty">
          <p>No upcoming events</p>
          <p>Create an event to bring the group together.</p>
          <button
            type="button"
            className="group-button secondary"
            onClick={() => setIsCreateOpen(true)}
          >
            + Create Event
          </button>
        </div>
      )}

      {upcoming && upcoming.length > 0 && (
        <>
          <ul className="group-events-preview-list">
            {upcoming.map((event) => (
              <li key={event.id} className="group-events-preview-item">
                <span className="group-events-preview-title">
                  {event.title}
                </span>
                <span className="group-events-preview-time">
                  {formatDateTime(event.eventTime)}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="group-see-all" onClick={onSeeAll}>
            View all events →
          </button>
        </>
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
