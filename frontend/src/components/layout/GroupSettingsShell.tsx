"use client";

import PlanetBackground from "@/components/space/PlanetBackground";
import {
  PlanetPreferenceProvider,
  usePlanetPreference,
} from "@/components/space/PlanetPreferenceProvider";
import { GroupsSearchProvider } from "@/features/groups/context/GroupsSearchProvider";
import styles from "./GroupSettingsShell.module.css";

function PlanetAwareSettingsShell({ children }: { children: React.ReactNode }) {
  const { selectedPlanetId, planetModelEnabled, preferenceReady, themeStyle } =
    usePlanetPreference();

  return (
    <GroupsSearchProvider>
      <div className={styles.shell} data-planet={selectedPlanetId} style={themeStyle}>
        {preferenceReady && planetModelEnabled ? <PlanetBackground /> : null}
        <a href="#settings-content" className={styles.skipLink}>Skip to content</a>
        <div id="settings-content" tabIndex={-1} className={styles.content}>
          {children}
        </div>
      </div>
    </GroupsSearchProvider>
  );
}

export default function GroupSettingsShell({ children }: { children: React.ReactNode }) {
  return (
    <PlanetPreferenceProvider>
      <PlanetAwareSettingsShell>{children}</PlanetAwareSettingsShell>
    </PlanetPreferenceProvider>
  );
}
