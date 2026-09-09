"use client";

import UniverseTransitionProvider from "@/features/universe-transition/UniverseTransitionProvider";
import SpaceBackground from "@/components/space/SpaceBackground";
import { GroupsSearchProvider } from "@/features/groups/context/GroupsSearchProvider";
import TopNavbar from "./TopNavbar";
import AppSidebar from "./AppSidebar";
import { SidebarProvider, useSidebar } from "./sidebarContext";
import styles from "./AppShell.module.css";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { isOpen, isReady } = useSidebar();

  return (
    <div className={styles.shell} data-ready={isReady ? "true" : "false"}>
      <SpaceBackground />
      <a href="#page-content" className={styles.skipLink}>
        Skip to content
      </a>
      <AppSidebar />
      <div
        className={`${styles.mainArea} ${!isOpen ? styles.mainAreaCollapsed : ""}`}
      >
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
      <UniverseTransitionProvider>
        <SidebarProvider>
          <AppShellInner>{children}</AppShellInner>
        </SidebarProvider>
      </UniverseTransitionProvider>
    </GroupsSearchProvider>
  );
}
