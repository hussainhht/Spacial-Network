"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// The navbar and galaxy share only the input value. Debouncing, pagination,
// membership filters and API queries remain owned by GroupsPageContent.
const GroupsSearchContext = createContext<{
  search: string;
  setSearch: (value: string) => void;
} | null>(null);

export function GroupsSearchProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState("");
  return (
    <GroupsSearchContext.Provider value={{ search, setSearch }}>
      {children}
    </GroupsSearchContext.Provider>
  );
}

export function useGroupsSearch() {
  const context = useContext(GroupsSearchContext);
  if (!context) throw new Error("GroupsSearchProvider is required");
  return context;
}
