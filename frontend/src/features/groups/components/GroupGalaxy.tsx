"use client";

import { useUniverseTransition } from "@/features/universe-transition/UniverseTransitionProvider";
import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import type { Group } from "../types/group";
import { createOrbitLayout, ORBITS } from "../utils/orbitLayout";
import { GroupLoadError } from "./GroupPanels";
import GroupStar from "./GroupStar";
import GroupPreviewPanel from "./GroupPreviewPanel";
import styles from "./GroupGalaxy.module.css";

const EMPTY_GROUPS: Group[] = [];

export type GalaxyQueryState = {
  data: Group[] | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export default function GroupGalaxy({
  state,
  scope,
  search,
  rawSearch = "",
  mine,
  onBrowseAll,
}: {
  state: GalaxyQueryState;
  scope: string;
  search: string;
  rawSearch?: string;
  mine: boolean;
  onBrowseAll: () => void;
}) {
  const { register } = useUniverseTransition();
  const universePaused = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const syncMotionRef = useRef<(() => void) | null>(null);
  const [paused, setPaused] = useState(false);
  const [selection, setSelection] = useState<{
    id: number;
    scope: string;
  } | null>(null);
  const groups = state.data ?? EMPTY_GROUPS;
  const layout = useMemo(() => createOrbitLayout(groups), [groups]);
  // Only collection changes recreate the scoped timeline; selection never resets drift.
  const layoutKey = layout
    .map(({ group, ring, angle }) => `${group.id}:${ring}:${angle}`)
    .join("|");
  const selected =
    selection?.scope === scope
      ? groups.find((group) => group.id === selection.id)
      : undefined;
  if (
    selection &&
    (selection.scope !== scope || (!state.loading && !selected))
  ) {
    setSelection(null);
  }

  // Smoothly shift the galaxy scene left when a group star is selected, and return to center on close
  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add(
      "(min-width: 1000px) and (prefers-reduced-motion: no-preference)",
      () => {
        const root = rootRef.current;
        if (!root) return;
        if (selected) {
          gsap.to(root, {
            xPercent: -6,
            duration: 0.45,
            ease: "power2.out",
          });
        } else {
          gsap.to(root, {
            xPercent: 0,
            duration: 0.4,
            ease: "power2.out",
          });
        }
      },
    );
    return () => media.revert();
  }, [Boolean(selected)]);

  useLayoutEffect(() => {
    const media = gsap.matchMedia();
    media.add(
      "(min-width: 1000px) and (prefers-reduced-motion: no-preference)",
      () => {
        const root = rootRef.current;
        if (!root) return;
        const timeline = gsap.timeline();
        // Each ring and its labels turn together in opposite directions, keeping text upright.
        ORBITS.forEach((orbit, ring) => {
          const labels = root.querySelectorAll(
            `[data-counter-orbit="${ring}"]`,
          );
          if (!labels.length) return;
          const rotation = orbit.direction * 360;
          timeline.to(
            root.querySelector(`[data-orbit="${ring}"]`),
            {
              rotation,
              duration: orbit.duration,
              repeat: -1,
              ease: "none",
            },
            0,
          );
          timeline.to(
            labels,
            {
              rotation: -rotation,
              duration: orbit.duration,
              repeat: -1,
              ease: "none",
            },
            0,
          );
        });
        const sync = () => {
          timeline.paused(
            universePaused.current ||
              pausedRef.current ||
              document.hidden ||
              root.matches(":hover") ||
              root.contains(document.activeElement),
          );
        };
        syncMotionRef.current = sync;
        sync();
        root.addEventListener("pointerenter", sync);
        root.addEventListener("pointerleave", sync);
        root.addEventListener("focusin", sync);
        root.addEventListener("focusout", sync);
        document.addEventListener("visibilitychange", sync);
        return () => {
          syncMotionRef.current = null;
          root.removeEventListener("pointerenter", sync);
          root.removeEventListener("pointerleave", sync);
          root.removeEventListener("focusin", sync);
          root.removeEventListener("focusout", sync);
          document.removeEventListener("visibilitychange", sync);
        };
      },
    );
    return () => media.revert();
  }, [layoutKey]);

  useLayoutEffect(() => {
    pausedRef.current = paused;
    syncMotionRef.current?.();
  }, [paused]);

  useLayoutEffect(() => {
    const root = rootRef.current?.closest<HTMLElement>("[data-universe-scene]");
    if (!root) return;
    root.dataset.universeReady = String(!state.loading);
    return register("/groups", {
      root,
      pause: () => {
        universePaused.current = true;
        syncMotionRef.current?.();
      },
      resume: () => {
        universePaused.current = false;
        syncMotionRef.current?.();
      },
    });
  }, [register, state.loading, layoutKey]);

  function closePreview() {
    if (selected)
      document
        .getElementById(`group-star-${selected.id}`)
        ?.focus({ preventScroll: true });
    setSelection(null);
  }

  const query = (rawSearch || search).trim().toLowerCase();
  const empty = !state.loading && !state.error && groups.length === 0;

  return (
    <div
      className={styles.galaxy}
      onKeyDown={(event) => {
        if (event.key === "Escape" && selected) {
          event.preventDefault();
          closePreview();
        }
      }}
    >
      {/* Compact galaxy control cluster (Pause / Resume orbits) */}
      <button
        type="button"
        className={styles.galaxyControlBtn}
        aria-label={paused ? "Resume orbits" : "Pause orbits"}
        aria-pressed={paused}
        title={paused ? "Resume orbits" : "Pause orbits"}
        onClick={() => setPaused(!paused)}
      >
        {paused ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        )}
      </button>

      {state.error && (
        <GroupLoadError error={state.error} retry={state.refresh} />
      )}
      <div className={styles.explorer}>
        <div
          ref={rootRef}
          className={styles.scene}
          aria-label="Group galaxy"
          aria-busy={state.loading}
          data-paused={paused}
        >
          <div className={styles.rings} aria-hidden="true">
            {ORBITS.map((orbit) => (
              <span
                data-universe-ring
                key={orbit.radius}
                style={{ width: `${orbit.radius * 2}%` }}
              />
            ))}
          </div>
          <div data-universe-you className={styles.currentUser}>
            <span
              data-universe-core
              className={styles.userCore}
              aria-hidden="true"
            >
              ✦
            </span>
            <strong>You</strong>
            <span>Your universe starts here</span>
          </div>
          <div className={styles.nodes}>
            {ORBITS.map((_, ring) => (
              <ul
                key={ring}
                className={styles.orbit}
                data-orbit={ring}
                aria-label={`Orbit ${ring + 1}`}
              >
                {layout
                  .filter((position) => position.ring === ring)
                  .map((position) => {
                    const isMatching =
                      !query ||
                      position.group.title.toLowerCase().includes(query) ||
                      position.group.description.toLowerCase().includes(query);
                    const isSelected = selected?.id === position.group.id;
                    const isDimmed = Boolean(selected && !isSelected);

                    return (
                      <GroupStar
                        key={position.group.id}
                        position={position}
                        selected={isSelected}
                        dimmed={isDimmed}
                        matching={isMatching}
                        onSelect={() =>
                          setSelection({ id: position.group.id, scope })
                        }
                      />
                    );
                  })}
              </ul>
            ))}
          </div>
          {state.loading && !groups.length && (
            <div className={styles.skeletons} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          {state.loading && (
            <p className={styles.sceneStatus} role="status">
              Finding your communities…
            </p>
          )}
          {empty && (
            <div data-universe-ui className={styles.empty}>
              <h2>
                {search
                  ? "No stars found"
                  : mine
                    ? "Your galaxy is still quiet."
                    : "A new galaxy starts with you."}
              </h2>
              <p>
                {search
                  ? "No groups match this search. Try another name."
                  : "Discover a community or create your first group."}
              </p>
              {!search && (
                <div className="group-buttons">
                  {mine && (
                    <button
                      type="button"
                      className="group-button secondary"
                      onClick={onBrowseAll}
                    >
                      Discover Groups
                    </button>
                  )}
                  <Link href="/groups/create" className="group-button">
                    + Create Group
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
        {selected && (
          <div data-universe-ui className={styles.previewSlot}>
            <GroupPreviewPanel group={selected} onClose={closePreview} />
          </div>
        )}
      </div>
      <p className={styles.announcement} role="status">
        {selected
          ? `${selected.title} preview open. View Group follows the stars in the tab order.`
          : ""}
      </p>

    </div>
  );
}
