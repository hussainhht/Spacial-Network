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
export const PLANET_MODEL_ENABLED_STORAGE_KEY =
  "social-network:planet-model-enabled";
export const PLANET_SCROLL_FOLLOW_STORAGE_KEY =
  "social_network_planet_scroll_follow";

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
  planetModelEnabled: boolean;
  planetScrollFollowEnabled: boolean;
  preferenceReady: boolean;
  themeStyle: PlanetThemeStyle;
  selectPlanet: (planetId: PlanetId) => void;
  setPlanetModelEnabled: (enabled: boolean) => void;
  setPlanetScrollFollowEnabled: (enabled: boolean) => void;
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

interface StoredPlanetPreferences {
  planetId: PlanetId;
  modelEnabled: boolean;
  scrollFollowEnabled: boolean;
  legacyNone: boolean;
}

function readStoredPreferences(): StoredPlanetPreferences {
  try {
    const storedPlanet = window.localStorage.getItem(
      PLANET_PREFERENCE_STORAGE_KEY,
    );
    const storedModelEnabled = window.localStorage.getItem(
      PLANET_MODEL_ENABLED_STORAGE_KEY,
    );
    const storedScrollFollowEnabled = window.localStorage.getItem(
      PLANET_SCROLL_FOLLOW_STORAGE_KEY,
    );
    const legacyNone = storedPlanet === "none";

    return {
      planetId: isPlanetId(storedPlanet) ? storedPlanet : DEFAULT_PLANET_ID,
      modelEnabled:
        storedModelEnabled === "false"
          ? false
          : storedModelEnabled === "true"
            ? true
            : !legacyNone,
      scrollFollowEnabled: storedScrollFollowEnabled !== "false",
      legacyNone,
    };
  } catch {
    // Storage may be unavailable in hardened/private browser contexts.
  }
  return {
    planetId: DEFAULT_PLANET_ID,
    modelEnabled: true,
    scrollFollowEnabled: true,
    legacyNone: false,
  };
}

export function PlanetPreferenceProvider({ children }: { children: ReactNode }) {
  const [selectedPlanetId, setSelectedPlanetId] =
    useState<PlanetId>(DEFAULT_PLANET_ID);
  const [planetModelEnabled, setPlanetModelEnabledState] = useState(true);
  const [planetScrollFollowEnabled, setPlanetScrollFollowEnabledState] =
    useState(true);
  const [preferenceReady, setPreferenceReady] = useState(false);
  const selectionCommitted = useRef(false);
  const modelVisibilityCommitted = useRef(false);
  const scrollFollowCommitted = useRef(false);

  useEffect(() => {
    const hydrationFrame = window.requestAnimationFrame(() => {
      const storedPreferences = readStoredPreferences();
      const shouldRestorePlanet = !selectionCommitted.current;
      const shouldRestoreModelVisibility = !modelVisibilityCommitted.current;
      const shouldRestoreScrollFollow = !scrollFollowCommitted.current;
      if (shouldRestorePlanet) {
        setSelectedPlanetId(storedPreferences.planetId);
      }
      if (shouldRestoreModelVisibility) {
        setPlanetModelEnabledState(storedPreferences.modelEnabled);
      }
      if (shouldRestoreScrollFollow) {
        setPlanetScrollFollowEnabledState(
          storedPreferences.scrollFollowEnabled,
        );
      }
      if (storedPreferences.legacyNone) {
        try {
          if (shouldRestorePlanet) {
            window.localStorage.setItem(
              PLANET_PREFERENCE_STORAGE_KEY,
              storedPreferences.planetId,
            );
          }
          if (shouldRestoreModelVisibility) {
            window.localStorage.setItem(
              PLANET_MODEL_ENABLED_STORAGE_KEY,
              String(storedPreferences.modelEnabled),
            );
          }
        } catch {
          // The in-memory migration still works when persistence is unavailable.
        }
      }
      setPreferenceReady(true);
    });

    function syncPlanetFromAnotherTab(event: StorageEvent) {
      if (event.key === PLANET_PREFERENCE_STORAGE_KEY) {
        selectionCommitted.current = true;
        setPreferenceReady(true);
        if (event.newValue === "none") {
          modelVisibilityCommitted.current = true;
          setSelectedPlanetId(DEFAULT_PLANET_ID);
          setPlanetModelEnabledState(false);
          return;
        }
        setSelectedPlanetId(
          isPlanetId(event.newValue) ? event.newValue : DEFAULT_PLANET_ID,
        );
      }

      if (event.key === PLANET_MODEL_ENABLED_STORAGE_KEY) {
        modelVisibilityCommitted.current = true;
        setPreferenceReady(true);
        setPlanetModelEnabledState(event.newValue !== "false");
      }

      if (event.key === PLANET_SCROLL_FOLLOW_STORAGE_KEY) {
        scrollFollowCommitted.current = true;
        setPreferenceReady(true);
        setPlanetScrollFollowEnabledState(event.newValue !== "false");
      }
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
    setPreferenceReady(true);
    setSelectedPlanetId(validatedId);
    try {
      window.localStorage.setItem(PLANET_PREFERENCE_STORAGE_KEY, validatedId);
    } catch {
      // The in-memory preference still works when persistence is unavailable.
    }
  }, []);

  const setPlanetModelEnabled = useCallback((enabled: boolean) => {
    modelVisibilityCommitted.current = true;
    setPreferenceReady(true);
    setPlanetModelEnabledState(enabled);
    try {
      window.localStorage.setItem(
        PLANET_MODEL_ENABLED_STORAGE_KEY,
        String(enabled),
      );
    } catch {
      // The in-memory preference still works when persistence is unavailable.
    }
  }, []);

  const setPlanetScrollFollowEnabled = useCallback((enabled: boolean) => {
    scrollFollowCommitted.current = true;
    setPreferenceReady(true);
    setPlanetScrollFollowEnabledState(enabled);
    try {
      window.localStorage.setItem(
        PLANET_SCROLL_FOLLOW_STORAGE_KEY,
        String(enabled),
      );
    } catch {
      // The in-memory preference still works when persistence is unavailable.
    }
  }, []);

  const selectedPlanet = PLANET_REGISTRY[selectedPlanetId];
  const value = useMemo<PlanetPreferenceValue>(
    () => ({
      selectedPlanetId,
      selectedPlanet,
      planetModelEnabled,
      planetScrollFollowEnabled,
      preferenceReady,
      themeStyle: createThemeStyle(selectedPlanet.theme),
      selectPlanet,
      setPlanetModelEnabled,
      setPlanetScrollFollowEnabled,
    }),
    [
      planetModelEnabled,
      planetScrollFollowEnabled,
      preferenceReady,
      selectPlanet,
      selectedPlanet,
      selectedPlanetId,
      setPlanetModelEnabled,
      setPlanetScrollFollowEnabled,
    ],
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
