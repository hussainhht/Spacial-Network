"use client";

import { useState } from "react";
import Link from "next/link";
import AppIcon from "@/components/layout/AppIcon";
import GroupSearchInput from "./GroupSearchInput";
import styles from "./GroupsDirectory.module.css";
import { getGroups } from "../api/groups";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useGroupQuery, useMyGroups } from "../hooks/useGroupData";
import { InvitationsPanel } from "./GroupPanels";
import { useGroupsSearch } from "../context/GroupsSearchProvider";
import GroupsFilterTabs, { type GroupsTab } from "./GroupsFilterTabs";
import GroupList, { type GroupQueryState } from "./GroupList";

// Keep the existing API pagination and search behavior.
const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

export default function GroupsPageContent() {
  const [activeTab, setActiveTab] = useState<GroupsTab>("mine");
  const { search, setSearch } = useGroupsSearch();
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
    onClearSearch: () => setSearch(""),
    onPageChange: (page: number) =>
      setPagination({ search: debouncedSearch, page }),
  };

  return (
    <main className={`space-shell ${styles.page}`} aria-labelledby="groups-heading">
      <div className={styles.container}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>Your communities</p>
          <h1 id="groups-heading">Groups</h1>
          <p className={styles.description}>
            Discover communities, connect with people, and find the spaces that match your interests.
          </p>
        </header>
        <div className={styles.toolbar}>
          <GroupSearchInput value={search} onChange={setSearch} />
          <Link href="/groups/create" className={`group-button ${styles.create}`}>
            <AppIcon name="plus" /> Create Group
          </Link>
        </div>
        <GroupsFilterTabs activeTab={activeTab} onTabChange={changeTab} />
        <InvitationsPanel />
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
  onClearSearch: () => void;
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
  onClearSearch,
  onPageChange,
}: CollectionProps & { state: GroupQueryState; mine: boolean }) {
  return (
    <>
      <GroupList
        state={state}
        mine={mine}
        search={search}
        onBrowseAll={onBrowseAll}
        onClearSearch={onClearSearch}
        key={`${mine}:${page}:${search}`}
      />
      <div className={styles.pagination}>
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
          <nav className="group-buttons" aria-label="Group pages">
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
