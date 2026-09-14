"use client";

import { GroupsSearchProvider } from "@/features/groups/context/GroupsSearchProvider";
import TopNavbar from "./TopNavbar";
import PrimaryNavigation from "./PrimaryNavigation/PrimaryNavigation";
import styles from "./AppShell.module.css";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <GroupsSearchProvider>
      <div className={styles.shell}>
        <a href="#page-content" className={styles.skipLink}>
          Skip to content
        </a>
        <header className={styles.topbar}>
          <TopNavbar />
        </header>
        <div className={styles.sidebar}>
          <PrimaryNavigation />
        </div>
        <div id="page-content" tabIndex={-1} className={styles.routeContent}>
          {children}
        </div>
      </div>
    </GroupsSearchProvider>
  );
}
