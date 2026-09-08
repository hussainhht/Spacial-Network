"use client";

import Link from "next/link";
import { useState } from "react";
import { getGroups } from "../api/groups";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useGroupQuery, useMyGroups } from "../hooks/useGroupData";
import { InvitationsPanel } from "./GroupPanels";
import GroupGalaxy, { type GalaxyQueryState } from "./GroupGalaxy";
import GroupSearchInput from "./GroupSearchInput";
import GroupsFilterTabs, { type GroupsTab } from "./GroupsFilterTabs";
import styles from "./GroupGalaxy.module.css";

// Use the API's existing offset pagination to keep every galaxy readable.
const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

export default function GroupsPageContent() {
  const [activeTab, setActiveTab] = useState<GroupsTab>("mine");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [pagination, setPagination] = useState({
    search: debouncedSearch,
    page: 0,
  });
  if (pagination.search !== debouncedSearch) {
    setPagination({ search: debouncedSearch, page: 0 });
  }
  const page = pagination.search === debouncedSearch ? pagination.page : 0;
  function changeTab(tab: GroupsTab) {
    setActiveTab(tab);
    setPagination({ search: debouncedSearch, page: 0 });
  }
  const collectionProps = {
    search: debouncedSearch,
    page,
    onBrowseAll: () => changeTab("all"),
    onPageChange: (page: number) =>
      setPagination({ search: debouncedSearch, page }),
  };

  return (
    <main data-universe-scene="groups" className={`groups-page space-shell ${styles.page}`}>
      <div className="groups-container">
        <header data-universe-ui className="groups-page-header">
          <div>
            <p className="group-eyebrow">Find your people</p>
            <h1>Groups</h1>
            <p className="group-muted">
              Discover communities. Share an interest. Make a connection.
            </p>
          </div>
          <Link href="/groups/create" className="group-button">
            + Create Group
          </Link>
        </header>
        <InvitationsPanel />
        <div data-universe-ui className={styles.toolbar}>
          <GroupsFilterTabs activeTab={activeTab} onTabChange={changeTab} />
          <GroupSearchInput value={search} onChange={setSearch} />
        </div>
        <section
          id={`groups-tabpanel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`groups-tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === "mine" ? (
            <MyGroupsSection {...collectionProps} />
          ) : (
            <AllGroupsSection {...collectionProps} />
          )}
        </section>
      </div>
    </main>
  );
}

type CollectionProps = {
  search: string;
  page: number;
  onBrowseAll: () => void;
  onPageChange: (page: number) => void;
};

function MyGroupsSection(props: CollectionProps) {
  const state = useMyGroups(PAGE_SIZE, props.page * PAGE_SIZE, props.search);
  return <GroupCollection {...props} state={state} mine />;
}

function AllGroupsSection(props: CollectionProps) {
  const state = useGroupQuery(`groups:${props.search}:${props.page}`, () =>
    getGroups(PAGE_SIZE, props.page * PAGE_SIZE, props.search),
  );
  return <GroupCollection {...props} state={state} mine={false} />;
}

function GroupCollection({
  state,
  mine,
  search,
  page,
  onBrowseAll,
  onPageChange,
}: CollectionProps & { state: GalaxyQueryState; mine: boolean }) {
  return (
    <>
      <GroupGalaxy
        state={state}
        mine={mine}
        search={search}
        onBrowseAll={onBrowseAll}
        scope={`${mine}:${page}`}
      />
      <div data-universe-ui className={styles.pagination}>
        <p className="group-muted" role="status">
          {state.loading
            ? "Loading groups…"
            : state.error
              ? "Groups could not be updated."
              : state.data?.length
                ? `Showing ${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + state.data.length}${mine ? " of your groups" : " groups"}`
                : page > 0
                  ? "You’ve reached the end. Return to the previous groups."
                  : "No groups to show yet."}
        </p>
        {(page > 0 || state.data?.length === PAGE_SIZE) && (
          <nav className="group-buttons" aria-label="Galaxy pages">
            <button
              type="button"
              className="group-button secondary"
              disabled={page === 0 || state.loading}
              onClick={() => onPageChange(page - 1)}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="group-button secondary"
              disabled={
                state.loading ||
                !!state.error ||
                state.data?.length !== PAGE_SIZE
              }
              onClick={() => onPageChange(page + 1)}
            >
              Next groups →
            </button>
          </nav>
        )}
      </div>
    </>
  );
}
