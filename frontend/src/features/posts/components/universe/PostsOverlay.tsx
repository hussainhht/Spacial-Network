"use client";

import { useRef, useState } from "react";
import { useUniverseNavigation } from "@/features/solar-system/navigation/UniverseNavigationProvider";
import { useDestinationPresence } from "@/features/solar-system/navigation/useDestinationPresence";
import PostsPlaceholder from "./PostsPlaceholder";
import styles from "./PostsOverlay.module.css";

type PostsMode = "orbit" | "list";

const MODES: readonly { id: PostsMode; label: string }[] = [
  { id: "orbit", label: "Orbit" },
  { id: "list", label: "List" },
];

/**
 * Posts, as a destination of the persistent universe.
 *
 * There is no planet in this component. Earth is the persistent scene's own
 * Earth, which the camera frames to the right of this content (`earth-posts` in
 * `solar-system/navigation/destinations.ts`); this is ordinary DOM laid over it.
 * That split is the one the feed will keep: when orbit mode places posts around
 * the planet, the scene will supply anchor positions and the posts will stay
 * DOM cards, so text stays sharp and every control stays a real control.
 *
 * Phase 1 establishes the destination only. The mode switch is visual, and the
 * content area holds one static card at real post size.
 */
export default function PostsOverlay() {
  const overlay = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const presence = useDestinationPresence("earth-posts", overlay, heading);
  const { layout } = useUniverseNavigation();
  const [mode, setMode] = useState<PostsMode>("orbit");

  return (
    <main
      className={styles.page}
      aria-labelledby="app-page-title"
      data-layout={layout}
    >
      <div ref={overlay} className={styles.overlay} {...presence}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Posts</p>
          <h2 ref={heading} tabIndex={-1} className={styles.title}>
            Explore your orbit
          </h2>
          <p className={styles.lede}>
            What the people you follow are sharing, gathered around the world
            you share it with.
          </p>
          <div className={styles.modes} role="group" aria-label="Posts view">
            {MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={styles.mode}
                aria-pressed={mode === option.id}
                onClick={() => setMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </header>

        {/* Orbit and List modes render here. The width is reserved now so the
            camera composition can be judged against real content. */}
        <section className={styles.content} aria-label="Posts">
          <PostsPlaceholder />
        </section>
      </div>
    </main>
  );
}
