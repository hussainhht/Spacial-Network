"use client";

import Link from "next/link";
import { useState } from "react";
import { getGroups } from "../api/groups";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useGroupQuery, useMyGroups } from "../hooks/useGroupData";
import { GroupLoadError, InvitationsPanel } from "./GroupPanels";
import GroupCard from "./GroupCard";
import GroupSearchInput from "./GroupSearchInput";
import GroupsFilterTabs, { type GroupsTab } from "./GroupsFilterTabs";

const PAGE_SIZE = 20;
const MY_GROUPS_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 300;

export default function GroupsPageContent() {
  const [activeTab, setActiveTab] = useState<GroupsTab>("mine");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
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
        <GroupsFilterTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <GroupSearchInput value={search} onChange={setSearch} />
        {activeTab === "mine" && (
          <section
            id="groups-tabpanel-mine"
            role="tabpanel"
            aria-labelledby="groups-tab-mine"
            tabIndex={0}
          >
            <p className="group-muted">Groups you&apos;re already part of.</p>
            <MyGroupsSection
              onBrowseAll={() => setActiveTab("all")}
              search={debouncedSearch}
            />
          </section>
        )}
        {activeTab === "all" && (
          <section
            id="groups-tabpanel-all"
            role="tabpanel"
            aria-labelledby="groups-tab-all"
            tabIndex={0}
          >
            <p className="group-muted">Discover communities.</p>
            <AllGroupsSection key={debouncedSearch} search={debouncedSearch} />
          </section>
        )}
      </div>
    </main>
  );
}

function MyGroupsSection({
  onBrowseAll,
  search,
}: {
  onBrowseAll: () => void;
  search: string;
}) {
  const state = useMyGroups(MY_GROUPS_LIMIT, 0, search);
  const isSearching = search.length > 0;
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
          {isSearching ? (
            <>
              <h3>No groups found</h3>
              <p>No groups found in My Groups. Try searching with another name.</p>
            </>
          ) : (
            <>
              <h3>No groups yet</h3>
              <p>
                You haven&apos;t joined any groups yet. Explore available
                communities or create your own group.
              </p>
              <div className="group-buttons">
                <button
                  type="button"
                  className="group-button secondary"
                  onClick={onBrowseAll}
                >
                  Browse All Groups
                </button>
                <Link href="/groups/create" className="group-button">
                  + Create Group
                </Link>
              </div>
            </>
          )}
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

function AllGroupsSection({ search }: { search: string }) {
  const [pages, setPages] = useState(1);
  return (
    <>
      {Array.from({ length: pages }, (_, page) => (
        <GroupsPage
          key={page}
          page={page}
          search={search}
          last={page === pages - 1}
          loadMore={() => setPages((p) => p + 1)}
        />
      ))}
    </>
  );
}

function GroupsPage({
  page,
  search,
  last,
  loadMore,
}: {
  page: number;
  search: string;
  last: boolean;
  loadMore: () => void;
}) {
  const state = useGroupQuery(`groups:${search}:${page}`, () =>
    getGroups(PAGE_SIZE, page * PAGE_SIZE, search),
  );
  const isSearching = search.length > 0;
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
          {isSearching ? (
            <>
              <h3>No groups found</h3>
              <p>Try searching with another name.</p>
            </>
          ) : (
            <>
              <h3>No groups available yet</h3>
              <p>
                Create the first group and invite people who share your
                interests.
              </p>
            </>
          )}
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
