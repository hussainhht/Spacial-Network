"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import {
  DEFAULT_PLANET_ID,
  readPlanetPreference,
  writePlanetPreference,
  subscribeToPlanetPreference,
  type PlanetId,
} from "../storage/planetPreferenceStorage";

interface PlanetPreferenceContextValue {
  activePlanet: PlanetId;
  isReady: boolean;
  setActivePlanet: (id: PlanetId) => void;
}

const PlanetPreferenceContext = createContext<PlanetPreferenceContextValue | null>(null);

function serverPreference(): null {
  return null;
}

export function PlanetPreferenceProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(subscribeToPlanetPreference, readPlanetPreference, serverPreference);
  return (
    <PlanetPreferenceContext.Provider
      value={{
        activePlanet: preference ?? DEFAULT_PLANET_ID,
        isReady: preference !== null,
        setActivePlanet: writePlanetPreference,
      }}
    >
      {children}
    </PlanetPreferenceContext.Provider>
  );
}

export function usePlanetPreference(): PlanetPreferenceContextValue {
  const context = useContext(PlanetPreferenceContext);
  if (!context) throw new Error("usePlanetPreference must be used within a PlanetPreferenceProvider");
  return context;
}
