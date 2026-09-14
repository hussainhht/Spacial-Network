"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  DEFAULT_PLANET_ID,
  PLANET_REGISTRY,
  getPlanetConfig,
  isPlanetId,
  type PlanetConfig,
  type PlanetId,
  type PlanetTheme,
} from "./modelsRegistry";

export const PLANET_PREFERENCE_STORAGE_KEY = "social-network:planet";

type PlanetThemeStyle = CSSProperties & {
  "--planet-accent": string;
  "--planet-accent-hover": string;
  "--planet-accent-active": string;
  "--planet-accent-soft": string;
  "--planet-border": string;
  "--planet-border-strong": string;
  "--planet-glow": string;
  "--planet-surface-tint": string;
  "--planet-focus-ring": string;
};

interface PlanetPreferenceValue {
  selectedPlanetId: PlanetId;
  selectedPlanet: PlanetConfig;
  themeStyle: PlanetThemeStyle;
  selectPlanet: (planetId: PlanetId) => void;
}

const PlanetPreferenceContext = createContext<PlanetPreferenceValue | null>(
  null,
);

function createThemeStyle(theme: PlanetTheme): PlanetThemeStyle {
  return {
    "--planet-accent": theme.accent,
    "--planet-accent-hover": theme.accentHover,
    "--planet-accent-active": theme.accentActive,
    "--planet-accent-soft": theme.accentSoft,
    "--planet-border": theme.border,
    "--planet-border-strong": theme.borderStrong,
    "--planet-glow": theme.glow,
    "--planet-surface-tint": theme.surfaceTint,
    "--planet-focus-ring": theme.focusRing,
  };
}

function readStoredPlanet(): PlanetId {
  try {
    const storedValue = window.localStorage.getItem(
      PLANET_PREFERENCE_STORAGE_KEY,
    );
    if (isPlanetId(storedValue)) return storedValue;
  } catch {
    // Storage may be unavailable in hardened/private browser contexts.
  }
  return DEFAULT_PLANET_ID;
}

export function PlanetPreferenceProvider({ children }: { children: ReactNode }) {
  const [selectedPlanetId, setSelectedPlanetId] =
    useState<PlanetId>(DEFAULT_PLANET_ID);
  const selectionCommitted = useRef(false);

  useEffect(() => {
    const hydrationFrame = window.requestAnimationFrame(() => {
      if (!selectionCommitted.current) {
        setSelectedPlanetId(readStoredPlanet());
      }
    });

    function syncPlanetFromAnotherTab(event: StorageEvent) {
      if (event.key !== PLANET_PREFERENCE_STORAGE_KEY) return;
      selectionCommitted.current = true;
      setSelectedPlanetId(
        isPlanetId(event.newValue) ? event.newValue : DEFAULT_PLANET_ID,
      );
    }

    window.addEventListener("storage", syncPlanetFromAnotherTab);
    return () => {
      window.cancelAnimationFrame(hydrationFrame);
      window.removeEventListener("storage", syncPlanetFromAnotherTab);
    };
  }, []);

  const selectPlanet = useCallback((planetId: PlanetId) => {
    const validatedId = getPlanetConfig(planetId).id;
    selectionCommitted.current = true;
    setSelectedPlanetId(validatedId);
    try {
      window.localStorage.setItem(PLANET_PREFERENCE_STORAGE_KEY, validatedId);
    } catch {
      // The in-memory preference still works when persistence is unavailable.
    }
  }, []);

  const selectedPlanet = PLANET_REGISTRY[selectedPlanetId];
  const value = useMemo<PlanetPreferenceValue>(
    () => ({
      selectedPlanetId,
      selectedPlanet,
      themeStyle: createThemeStyle(selectedPlanet.theme),
      selectPlanet,
    }),
    [selectPlanet, selectedPlanet, selectedPlanetId],
  );

  return (
    <PlanetPreferenceContext.Provider value={value}>
      {children}
    </PlanetPreferenceContext.Provider>
  );
}

export function usePlanetPreference() {
  const value = useContext(PlanetPreferenceContext);
  if (!value) {
    throw new Error(
      "usePlanetPreference must be used inside PlanetPreferenceProvider.",
    );
  }
  return value;
}
