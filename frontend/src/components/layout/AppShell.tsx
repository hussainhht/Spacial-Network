"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { GroupsSearchProvider } from "@/features/groups/context/GroupsSearchProvider";
import PlanetBackground from "@/components/space/PlanetBackground";
import {
  PlanetPreferenceProvider,
  usePlanetPreference,
} from "@/components/space/PlanetPreferenceProvider";
import TopNavbar from "./TopNavbar";
import PrimaryNavigation from "./PrimaryNavigation/PrimaryNavigation";
import styles from "./AppShell.module.css";

function PlanetAwareShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    selectedPlanetId,
    planetModelEnabled,
    preferenceReady,
    themeStyle,
  } = usePlanetPreference();

  useEffect(() => {
    const pane = document.getElementById("page-content");
    if (pane) {
      pane.scrollTop = 0;
    }
  }, [pathname]);

  return (
    <GroupsSearchProvider>
      <div
        className={styles.shell}
        data-planet={selectedPlanetId}
        style={themeStyle}
      >
        {preferenceReady && planetModelEnabled ? (
          <PlanetBackground />
        ) : null}
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PlanetPreferenceProvider>
      <PlanetAwareShell>{children}</PlanetAwareShell>
    </PlanetPreferenceProvider>
  );
}
