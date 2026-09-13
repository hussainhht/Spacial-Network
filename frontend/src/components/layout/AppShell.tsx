"use client";

import { GroupsSearchProvider } from "@/features/groups/context/GroupsSearchProvider";
import TopNavbar from "./TopNavbar";
import PrimaryNavigation from "./PrimaryNavigation/PrimaryNavigation";
import { SidebarProvider, useSidebar } from "./sidebarContext";
import styles from "./AppShell.module.css";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { isOpen, isReady } = useSidebar();

  return (
    <div className={styles.shell} data-ready={isReady}>
      <a href="#page-content" className={styles.skipLink}>
        Skip to content
      </a>
      <PrimaryNavigation />
      <div className={`${styles.mainArea} ${isOpen ? "" : styles.mainAreaFull}`}>
        <TopNavbar />
        <div id="page-content" tabIndex={-1} className={styles.routeContent}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <GroupsSearchProvider>
      <SidebarProvider>
        <AppShellInner>{children}</AppShellInner>
      </SidebarProvider>
    </GroupsSearchProvider>
  );
}
