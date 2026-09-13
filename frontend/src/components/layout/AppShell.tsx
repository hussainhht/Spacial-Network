"use client";

import { usePathname } from "next/navigation";
import UniverseTransitionProvider from "@/features/universe-transition/UniverseTransitionProvider";
import SpaceBackground from "@/components/space/SpaceBackground";
import PersistentUniverseScene from "@/features/solar-system/PersistentUniverseScene";
import UniverseNavigationProvider from "@/features/solar-system/navigation/UniverseNavigationProvider";
import { GroupsSearchProvider } from "@/features/groups/context/GroupsSearchProvider";
import TopNavbar from "./TopNavbar";
import AppSidebar from "./AppSidebar";
import { shellLayoutFor } from "./shellLayout";
import { SidebarProvider, useSidebar } from "./sidebarContext";
import styles from "./AppShell.module.css";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { isOpen, isReady } = useSidebar();
  const layout = shellLayoutFor(usePathname());
  // Navbar-only routes do not render the sidebar and do not reserve its column:
  // `mainAreaFull` drops the margin *and* sets `--sidebar-width` to zero, so
  // nothing downstream can lay itself out around a panel that is not there.
  const sidebar = layout === "sidebar";

  return (
    <div
      className={styles.shell}
      data-ready={isReady ? "true" : "false"}
      data-shell={layout}
    >
      <SpaceBackground />
      <a href="#page-content" className={styles.skipLink}>
        Skip to content
      </a>
      {sidebar && <AppSidebar />}
      <div
        className={`${styles.mainArea} ${sidebar && isOpen ? "" : styles.mainAreaFull}`}
      >
        <TopNavbar />
        <div className={styles.routeStage}>
          {/* Above the route boundary, so it survives navigation between the
              universe routes; the route content is laid over it. */}
          <PersistentUniverseScene />
          <div id="page-content" tabIndex={-1} className={styles.routeContent}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <GroupsSearchProvider>
      <UniverseNavigationProvider>
        <UniverseTransitionProvider>
          <SidebarProvider>
            <AppShellInner>{children}</AppShellInner>
          </SidebarProvider>
        </UniverseTransitionProvider>
      </UniverseNavigationProvider>
    </GroupsSearchProvider>
  );
}
