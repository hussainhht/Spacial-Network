"use client";

import { useMemo, useState } from "react";
import { useGroupEvents } from "../../hooks/useGroupData";
import type { GroupEvent, GroupMember } from "../../types/group";
import CreateEventModal from "./CreateEventModal";
import EventCard from "./EventCard";
import { GroupLoadError } from "../GroupPanels";
import AppIcon from "@/components/layout/AppIcon";

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
	const [period, setPeriod] = useState<"upcoming" | "past">("upcoming");
	const [search, setSearch] = useState("");
	const [now] = useState(Date.now);
  const usernameById = useMemo(() => {
    const map = new Map<number, string>();
    members?.forEach((member) => map.set(member.userId, member.username));
    return map;
  }, [members]);
	const filteredEvents = useMemo(() => {
	  const query = search.trim().toLowerCase();
	  return (events.data ?? []).filter((event) => {
		const timestamp = new Date(event.eventTime).getTime();
		const periodMatches = period === "upcoming" ? timestamp >= now : timestamp < now;
		const searchMatches = !query || event.title.toLowerCase().includes(query) || event.description.toLowerCase().includes(query);
		return periodMatches && searchMatches;
	  });
	}, [events.data, now, period, search]);

  return (
    <section
      className="group-panel group-events"
      aria-labelledby="events-heading"
    >
      <div className="group-section-heading">
		<div className="group-events-heading-copy"><span className="group-events-heading-icon"><AppIcon name="calendar" /></span><div><h2 id="events-heading">Events</h2><p>Upcoming events and group activities.</p></div></div>
        <button
          type="button"
		  className="group-event-create-button"
          onClick={() => setIsCreateOpen(true)}
        >
		  <AppIcon name="plus" width={16} height={16} /> Create event
        </button>
      </div>
	  <div className="group-events-toolbar">
		<div className="group-events-scope" aria-label="Event scope"><button type="button" aria-pressed="true">All events</button><span>Group events</span></div>
		<div className="group-events-period" aria-label="Event period"><button type="button" aria-pressed={period === "upcoming"} onClick={() => setPeriod("upcoming")}>Upcoming</button><button type="button" aria-pressed={period === "past"} onClick={() => setPeriod("past")}>Past</button></div>
		<label className="group-events-search"><AppIcon name="search" width={16} height={16} /><span className="sr-only">Search events</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events…" /></label>
	  </div>

      {events.loading && !events.data && (
        <p className="group-muted" role="status">
          Loading events...
        </p>
      )}

      {events.error && (
        <GroupLoadError error={events.error} retry={events.refresh} />
      )}

	  {!events.loading && !events.error && filteredEvents.length === 0 && (
        <div className="group-empty">
		  <h3>{search ? "No matching events" : period === "upcoming" ? "No upcoming events yet" : "No past events"}</h3>
		  <p>{search ? "Try a different search." : period === "upcoming" ? "Create an event for your group to get started." : "Past events will appear here."}</p>
        </div>
      )}

	  {filteredEvents.length > 0 && (
        <ul className="group-events-list">
		  {filteredEvents.map((event: GroupEvent) => (
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
