"use client";

import Link from "next/link";
import { useState } from "react";
import { getGroups } from "../api/groups";
import { useGroupQuery, useMyGroups } from "../hooks/useGroupData";
import { GroupLoadError, InvitationsPanel } from "./GroupPanels";
import GroupCard from "./GroupCard";

const PAGE_SIZE = 20;
const MY_GROUPS_LIMIT = 100;

export default function GroupsPageContent() {
  const [pages, setPages] = useState(1);
  return (
    <main className="groups-page space-shell">
      <div className="groups-container">
        <header className="groups-page-header">
          <div>
            <p className="group-eyebrow">Find your people</p>
            <h1>Groups</h1>
            <p className="group-muted">
              Discover communities. Share an interest. Make a connection.
            </p>
          </div>
          <Link href="/groups/create" className="new-group-link">
            + Create Group
          </Link>
        </header>
        <InvitationsPanel />
        <section aria-labelledby="my-groups-heading">
          <div className="group-section-heading">
            <h2 id="my-groups-heading">My Groups</h2>
          </div>
          <p className="group-muted">Groups you&apos;re already part of.</p>
          <MyGroupsSection />
        </section>
        <section aria-labelledby="browse-heading">
          <div className="group-section-heading">
            <h2 id="browse-heading">Explore communities</h2>
          </div>
          {Array.from({ length: pages }, (_, page) => (
            <GroupsPage
              key={page}
              page={page}
              last={page === pages - 1}
              loadMore={() => setPages((p) => p + 1)}
            />
          ))}
        </section>
      </div>
    </main>
  );
}

function MyGroupsSection() {
  const state = useMyGroups(MY_GROUPS_LIMIT, 0);
  return (
    <>
      {state.loading && (
        <p className="group-muted" role="status">
          Loading your groups…
        </p>
      )}
      {state.error && (
        <GroupLoadError error={state.error} retry={state.refresh} />
      )}
      {!state.loading && !state.error && state.data?.length === 0 && (
        <div className="group-panel group-empty">
          <h3>No groups yet</h3>
          <p>
            You haven&apos;t joined any groups yet. Explore communities below
            or create your own.
          </p>
        </div>
      )}
      {!!state.data?.length && (
        <div className="groups-list">
          {state.data.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </>
  );
}
function GroupsPage({
  page,
  last,
  loadMore,
}: {
  page: number;
  last: boolean;
  loadMore: () => void;
}) {
  const state = useGroupQuery(`groups:${page}`, () =>
    getGroups(PAGE_SIZE, page * PAGE_SIZE),
  );
  return (
    <>
      {state.loading && (
        <p className="group-muted" role="status">
          Loading groups…
        </p>
      )}
      {state.error && (
        <GroupLoadError error={state.error} retry={state.refresh} />
      )}
      {!state.loading && !state.error && !state.data?.length && page === 0 && (
        <div className="group-panel group-empty">
          <h3>A community starts with you</h3>
          <p>
            Create the first group and invite people who share your interests.
          </p>
        </div>
      )}
      <div className="groups-list">
        {state.data?.map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}
      </div>
      {last && state.data?.length === PAGE_SIZE && (
        <button
          type="button"
          className="group-button secondary group-load-more"
          disabled={state.loading}
          onClick={loadMore}
        >
          Load more groups
        </button>
      )}
    </>
  );
}
