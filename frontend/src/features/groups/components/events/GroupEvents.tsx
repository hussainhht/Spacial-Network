"use client";

import { useMemo, useRef, useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { useGroupEvents } from "../../hooks/useGroupData";
import type { GroupEvent, GroupMember } from "../../types/group";
import { GroupLoadError } from "../GroupPanels";
import CreateEventPanel from "./CreateEventPanel";
import EventCard from "./EventCard";

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
      <section
        className="group-panel group-member-only"
        aria-labelledby="events-heading"
      >
        <span className="group-member-only-icon" aria-hidden="true">
          🔒
        </span>
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
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [period, setPeriod] = useState<"upcoming" | "past">("upcoming");
  const [search, setSearch] = useState("");
  const [now] = useState(Date.now);
  const hasSearch = search.trim().length > 0;

  const usernameById = useMemo(() => {
    const map = new Map<number, string>();
    members?.forEach((member) => map.set(member.userId, member.username));
    return map;
  }, [members]);

  const eventGroups = useMemo(() => {
    const upcoming: GroupEvent[] = [];
    const past: GroupEvent[] = [];
    for (const event of events.data ?? []) {
      const timestamp = new Date(event.eventTime).getTime();
      if (timestamp >= now) upcoming.push(event);
      else past.push(event);
    }
    upcoming.sort(
      (left, right) =>
        new Date(left.eventTime).getTime() - new Date(right.eventTime).getTime(),
    );
    past.sort(
      (left, right) =>
        new Date(right.eventTime).getTime() - new Date(left.eventTime).getTime(),
    );
    return { upcoming, past };
  }, [events.data, now]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return eventGroups[period].filter((event) => {
      const creator = usernameById.get(event.createdBy)?.toLowerCase() ?? "";
      return (
        !query ||
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        creator.includes(query)
      );
    });
  }, [eventGroups, period, search, usernameById]);

  function focusCreatePanel() {
    document.getElementById("create-event-panel")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    window.setTimeout(() => titleInputRef.current?.focus(), 250);
  }

  return (
    <section className="group-panel group-events" aria-labelledby="events-heading">
      <div className="group-section-heading group-events-header">
        <div className="group-events-heading-copy">
          <span className="group-events-heading-icon">
            <AppIcon name="calendar" />
          </span>
          <div>
            <h2 id="events-heading">Events</h2>
            <p>Bring your community together with events.</p>
          </div>
        </div>
        <button
          type="button"
          className="group-event-create-button"
          onClick={focusCreatePanel}
        >
          <AppIcon name="plus" width={16} height={16} /> Create event
        </button>
      </div>

      <div className="group-events-toolbar">
        <div
          className="group-events-period"
          aria-label="Filter events by date"
        >
          <button
            type="button"
            aria-pressed={period === "upcoming"}
            onClick={() => setPeriod("upcoming")}
          >
            Upcoming <span>{eventGroups.upcoming.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={period === "past"}
            onClick={() => setPeriod("past")}
          >
            Past <span>{eventGroups.past.length}</span>
          </button>
        </div>
        <label className="group-events-search">
          <AppIcon name="search" width={16} height={16} />
          <span className="sr-only">Search events</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search events…"
          />
        </label>
      </div>

      <div className="group-events-layout">
        <div className="group-events-main">
          {events.loading && !events.data && (
            <p className="group-muted" role="status">
              Loading events…
            </p>
          )}
          {events.error && (
            <GroupLoadError error={events.error} retry={events.refresh} />
          )}

          {!events.loading && !events.error && filteredEvents.length === 0 && (
            <div className="group-empty group-events-empty">
              <span aria-hidden="true">
                <AppIcon
                  name={hasSearch ? "search" : "orbit"}
                  width={24}
                  height={24}
                />
              </span>
              <h3>
                {hasSearch
                  ? `No events match “${search.trim()}”`
                  : period === "upcoming"
                    ? "No upcoming events"
                    : "No past events yet"}
              </h3>
              <p>
                {hasSearch
                  ? "Try another search."
                  : period === "upcoming"
                    ? "Create the first event and give the group something to look forward to."
                    : "Completed events will appear here."}
              </p>
              {!hasSearch && period === "upcoming" && (
                <button type="button" onClick={focusCreatePanel}>
                  Create an event
                </button>
              )}
            </div>
          )}

          {filteredEvents.length > 0 && (
            <ul className="group-events-list" data-motion-list>
              {filteredEvents.map((event, index) => (
                <li key={event.id}>
                  <EventCard
                    event={event}
                    groupId={groupId}
                    isMember
                    isNextUp={period === "upcoming" && index === 0}
                    creatorUsername={usernameById.get(event.createdBy)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <CreateEventPanel groupId={groupId} titleInputRef={titleInputRef} />
      </div>
    </section>
  );
}
