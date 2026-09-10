"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { normalizeWheelDelta } from "./wheelInput";

/** One deliberate gesture should move one planet. These are tuned for that:
 * anything below the threshold is noise, and momentum after a trackpad flick
 * must not keep firing. */
const WHEEL_THRESHOLD = 80;
/** A sustained scroll (a mouse wheel held spinning) has to earn each extra
 * step, so it advances steadily instead of all at once. */
const WHEEL_SUSTAIN = 260;
/** A pause this long ends the gesture; the next event starts a fresh one. */
const GESTURE_GAP_MS = 140;
/** Inertial deltas only ever decay. A delta clearly larger than anything seen
 * so far is a new push of the fingers, not the tail of the last one. */
const FRESH_INPUT_RATIO = 1.15;
const SWIPE_THRESHOLD = 56;

/** A swipe must not start on something the reader meant to press. */
const TAP_TARGETS = "a, button, input, textarea, select, [contenteditable]";

/** Controls that use the arrow keys themselves. Buttons and links are absent
 * on purpose: they answer to Enter and Space, so leaving a destination button
 * focused must not switch the arrow keys off. */
const KEY_TARGETS = [
  "input",
  "textarea",
  "select",
  "[contenteditable]",
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="combobox"]',
  '[role="radiogroup"]',
  '[role="tablist"]',
  '[role="tab"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="tree"]',
  '[role="grid"]',
  "dialog",
].join(", ");

function matchesTarget(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

/**
 * Turns wheel, touch and key input into at most one "advance by one" intent at
 * a time, and binds each listener exactly once for the life of the surface.
 *
 * It knows nothing about planets or animation: it reports intent, and the loop
 * decides whether it can act on it.
 */
export function usePlanetGestures({
  surface,
  enabled,
  onStep,
}: {
  surface: HTMLElement | null;
  enabled: boolean;
  onStep: (direction: 1 | -1) => void;
}): void {
  const stepRef = useRef(onStep);
  useLayoutEffect(() => {
    stepRef.current = onStep;
  }, [onStep]);

  useEffect(() => {
    if (!surface || !enabled) return;

    // --- wheel / trackpad -------------------------------------------------
    let accumulated = 0;
    let peak = 0;
    let armed = true;
    let lastEvent = 0;

    const fire = (direction: 1 | -1) => {
      accumulated = 0;
      armed = false;
      stepRef.current(direction);
    };

    const handleWheel = (event: WheelEvent) => {
      const delta = normalizeWheelDelta(event, surface.clientHeight || 800);
      if (delta === 0) return;
      const now = event.timeStamp || performance.now();
      const magnitude = Math.abs(delta);

      if (now - lastEvent > GESTURE_GAP_MS) {
        // A fresh gesture: forget the previous one entirely.
        accumulated = 0;
        peak = 0;
        armed = true;
      } else if (!armed && magnitude > peak * FRESH_INPUT_RATIO) {
        // Stronger than anything in this gesture so far, so it is a new push
        // rather than the decaying tail of the one already acted on.
        accumulated = 0;
        armed = true;
      }
      lastEvent = now;
      peak = Math.max(peak, magnitude);

      // Direction reversal mid-gesture should not have to cancel out the
      // travel already banked in the other direction.
      if (accumulated !== 0 && Math.sign(delta) !== Math.sign(accumulated)) {
        accumulated = 0;
        armed = true;
      }
      accumulated += delta;

      const needed = armed ? WHEEL_THRESHOLD : WHEEL_SUSTAIN;
      if (Math.abs(accumulated) >= needed) fire(accumulated > 0 ? 1 : -1);
    };

    // --- touch ------------------------------------------------------------
    let touchId: number | null = null;
    let touchOrigin = 0;
    let touchArmed = false;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || matchesTarget(event.target, TAP_TARGETS))
        return;
      const touch = event.touches[0];
      touchId = touch.identifier;
      touchOrigin = touch.clientY;
      touchArmed = true;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (touchId === null || !touchArmed) return;
      const touch = Array.from(event.touches).find(
        (candidate) => candidate.identifier === touchId,
      );
      if (!touch) return;
      const travel = touchOrigin - touch.clientY;
      if (Math.abs(travel) < SWIPE_THRESHOLD) return;
      // Swipe up reveals what is below, matching a downward scroll.
      touchArmed = false;
      stepRef.current(travel > 0 ? 1 : -1);
    };

    const endTouch = () => {
      touchId = null;
      touchArmed = false;
    };

    // --- keyboard ---------------------------------------------------------
    // Bound to the window rather than the surface: after a page load focus sits
    // on the body, and a listener on the pane would never see the key at all.
    // The target guard below keeps it clear of the navbar's fields and menus.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // Fields, menus and other arrow-driven widgets keep their own semantics.
      if (matchesTarget(event.target, KEY_TARGETS)) return;
      const forward =
        event.key === "ArrowDown" ||
        event.key === "PageDown" ||
        event.key === "ArrowRight";
      const backward =
        event.key === "ArrowUp" ||
        event.key === "PageUp" ||
        event.key === "ArrowLeft";
      if (!forward && !backward) return;
      event.preventDefault();
      stepRef.current(forward ? 1 : -1);
    };

    // Passive throughout: the home pane owns its whole height and has nothing
    // to scroll, so there is never a default action worth cancelling, and a
    // non-passive wheel listener would put this work on the critical path.
    surface.addEventListener("wheel", handleWheel, { passive: true });
    surface.addEventListener("touchstart", handleTouchStart, { passive: true });
    surface.addEventListener("touchmove", handleTouchMove, { passive: true });
    surface.addEventListener("touchend", endTouch, { passive: true });
    surface.addEventListener("touchcancel", endTouch, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      surface.removeEventListener("wheel", handleWheel);
      surface.removeEventListener("touchstart", handleTouchStart);
      surface.removeEventListener("touchmove", handleTouchMove);
      surface.removeEventListener("touchend", endTouch);
      surface.removeEventListener("touchcancel", endTouch);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [surface, enabled]);
}
