"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "gsap";
import UniverseTransitionLayer from "./UniverseTransitionLayer";
import HomeEarth from "@/components/space/HomeEarth";
import type { UniverseHomeAPI } from "@/features/universe-home/contracts";
import { UNIVERSE_HOME_V1_ENABLED } from "@/features/universe-home/navigation/homeMode";
import UniverseCanvasHost from "@/features/universe-home/navigation/UniverseCanvasHost";
import { useUniverseHomeState } from "@/features/universe-home/navigation/useUniverseHomeState";
import { center, enterScene, exitScene, moveEarth } from "./animation";
import { useStageTravel } from "./useStageTravel";
import type {
  EarthHandle,
  SceneRegistration,
  UniverseRoute,
  UniverseTransitionState,
} from "./types";
import styles from "./UniverseTransition.module.css";

const motionQuery = "(prefers-reduced-motion: reduce)";

/** Home to Posts. Earth travels for `EARTH_TRAVEL`; the route is pushed part
 * way through, so React mounts Posts behind a scene that is still moving and
 * the reader never sees a blank frame. Both are short enough that the whole
 * move lands inside the ~1s a route change is allowed to feel like. */
const EARTH_TRAVEL = 0.78;
const ROUTE_PUSH_AT = 0.34;
const REDUCED_TRAVEL = 0.2;
/** Blend back to the home composition when Posts is left by ordinary
 * navigation, where there is no cinematic to own the move. */
const STAGE_RETURN = 0.55;
/** A destination that never reports itself ready must not strand the scene in
 * the overlay. Bounded wait, then settle wherever we are. */
const ARRIVAL_TIMEOUT = 1600;
const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

type API = {
  isTransitioning: boolean;
  transitionState: UniverseTransitionState;
  navigate: (href: string) => boolean;
  register: (route: UniverseRoute, scene: SceneRegistration) => () => void;
  /** The orbital feed's playhead, kept across route changes so returning to
   * Posts resumes on the card the reader left. Nothing to do with the planet
   * loop's phase. */
  orbitPosition: { current: number };
};
const Context = createContext<API | null>(null);
export function useUniverseTransition() {
  const value = useContext(Context);
  if (!value) throw new Error("UniverseTransitionProvider is required");
  return value;
}

// The universe home track reads from the same persistent provider. It is a
// second context only so that home consumers and the existing Sidebar/Groups
// consumers do not re-render for each other's updates; the state itself has
// exactly one owner.
const HomeContext = createContext<UniverseHomeAPI | null>(null);
export function useUniverseHome() {
  const value = useContext(HomeContext);
  if (!value) throw new Error("UniverseTransitionProvider is required");
  return value;
}

type Run = {
  from: string;
  to: UniverseRoute;
  pushed: boolean;
  reduced: boolean;
  timeline: gsap.core.Timeline;
  context: gsap.Context;
  deadline: number;
  origin: DOMRect;
  overflow: string;
  source: SceneRegistration;
};

export default function UniverseTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
  const router = useRouter();
  const [direction, setDirection] = useState<
    "home-to-groups" | "groups-to-home" | "home-to-posts" | null
  >(null);
  const active = direction !== null;
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const dockedViewport = useRef<HTMLElement | null>(null);
  const viewportResize = useRef<ResizeObserver | null>(null);
  const glow = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const earth = useRef<EarthHandle | null>(null);
  const scenes = useRef(new Map<string, SceneRegistration>());
  const run = useRef<Run | null>(null);
  const frame = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orbitPosition = useRef(0);
  const path = useRef(pathname);
  const lastOrigin = useRef<DOMRect | null>(null);
  const finishRef = useRef<() => void>(() => {});
  // The universe home loop: active/selected planet, the continuous loop phase,
  // the Home-to-Posts blend and the scene readiness snapshot. Deliberately
  // separate from `orbitPosition` above, which is the feed's post playhead.
  const homeTrack = useUniverseHomeState(pathname);
  const stageBlend = homeTrack.stage;
  const stageApplied = useRef(false);
  const { travel: travelStage } = useStageTravel({
    stageRef: homeTrack.stage,
    phaseRef: homeTrack.phase,
    scene: homeTrack.scene,
  });

  /** Pin the scene to a screen rectangle for the length of a move. The page
   * that owns its docking parent is about to be replaced, so the canvas spends
   * the transition in the fixed overlay instead — at exactly the geometry it
   * already had, which is why the reparenting is invisible. */
  const pinStage = useCallback((rect: DOMRect) => {
    const element = stage.current;
    if (!element) return;
    gsap.set(element, {
      position: "fixed",
      left: rect.left,
      top: rect.top,
      right: "auto",
      bottom: "auto",
      width: rect.width,
      height: rect.height,
      visibility: "visible",
    });
    element.dataset.universePinned = "true";
  }, []);
  const unpinStage = useCallback(() => {
    const element = stage.current;
    if (!element?.dataset.universePinned) return;
    delete element.dataset.universePinned;
    gsap.set(element, {
      clearProps: "position,left,top,right,bottom,width,height,visibility",
    });
  }, []);

  const park = useCallback((host: HTMLDivElement) => {
    if (host.parentElement !== layer.current) layer.current?.appendChild(host);
    host.style.display = "contents";
    // A pinned scene is mid-move and owns its own geometry; parking it is only
    // the reparenting, never the blanking.
    if (stage.current && !stage.current.dataset.universePinned) {
      stage.current.style.visibility = "hidden";
      delete stage.current.dataset.universeDocked;
    }
  }, []);

  const dock = useCallback(() => {
    const host = hostRef.current;
    if (!host || run.current) return;
    const home = scenes.current.get("/");
    if (UNIVERSE_HOME_V1_ENABLED) {
      // Home and Posts are two compositions of one scene, so both dock the same
      // canvas. Each owns a measured viewport inside its registered root and
      // the Canvas sizes itself from that box; docking into a 0x0 parent would
      // publish an unusable scene handle, so wait for a real measurement.
      const docking =
        path.current === "/" || path.current === "/posts"
          ? scenes.current.get(path.current)
          : undefined;
      const viewport =
        docking?.root.querySelector<HTMLElement>("[data-universe-viewport]") ??
        null;
      if (dockedViewport.current !== viewport) {
        if (dockedViewport.current)
          viewportResize.current?.unobserve(dockedViewport.current);
        dockedViewport.current = viewport;
        if (viewport) viewportResize.current?.observe(viewport);
      }
      if (viewport && viewport.clientWidth > 0 && viewport.clientHeight > 0) {
        // The host is only reparented while empty of layout; the portal target,
        // React tree, Canvas and WebGL context are untouched.
        if (host.parentElement !== viewport) viewport.appendChild(host);
        host.style.display = "contents";
        // The stage arrives after the lazy scene chunk resolves; docking must
        // not wait for it, and it must not stay hidden once it does arrive.
        stage.current?.style.removeProperty("visibility");
        if (stage.current) {
          // Planets are clickable on Home only. On Posts the canvas lies under
          // the cards and must not take the pointer from them.
          stage.current.dataset.universeDocked =
            path.current === "/posts" ? "posts" : "home";
        }
      } else {
        park(host);
      }
      return;
    }
    // Legacy Earth docking below, reached only with the v1 home disabled. It
    // must never run against the new scene's scroll or rotation roots.
    if (!stage.current) return;
    const anchor = home?.root.querySelector<HTMLElement>(
      "[data-universe-earth]",
    );
    if (path.current === "/" && anchor?.parentElement) {
      anchor.parentElement.appendChild(host);
      host.style.display = "contents";
      stage.current.removeAttribute("style");
      if (earth.current) {
        earth.current.group.visible = true;
        earth.current.group.position.set(0, 0, 0);
        earth.current.group.scale.setScalar(1);
        earth.current.motion.speed = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches
          ? 0
          : 0.04;
      }
    } else {
      layer.current?.appendChild(host);
      host.style.display = "contents";
      stage.current.style.visibility = "hidden";
      if (earth.current) {
        earth.current.motion.speed = 0;
        earth.current.group.visible = false;
      }
    }
  }, [park]);

  // The scene stage belongs to the lazily loaded Canvas, so re-dock when it
  // attaches or detaches rather than assuming it exists at mount.
  const setStage = useCallback(
    (element: HTMLDivElement | null) => {
      stage.current = element;
      dock();
    },
    [dock],
  );

  const finish = useCallback(() => {
    const current = run.current;
    run.current = null;
    cancelAnimationFrame(frame.current);
    if (watchdog.current) clearTimeout(watchdog.current);
    if (current) {
      try {
        current.timeline.kill();
        current.context.revert();
      } catch (error) {
        console.error("Universe animation cleanup failed", error);
      } finally {
        document.body.style.overflow = current.overflow;
      }
      current.source.resume();
    }
    unpinStage();
    shell.current?.removeAttribute("data-waiting");
    shell.current?.removeAttribute("data-running");
    for (const scene of scenes.current.values()) {
      scene.root.inert = false;
      scene.resume();
    }
    if (glow.current) gsap.set(glow.current, { opacity: 0 });
    setDirection(null);
    dock();
  }, [dock, unpinStage]);
  useLayoutEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  useLayoutEffect(() => {
    // The portal destination NEVER changes. Only its empty host is reparented,
    // preserving the same React tree, canvas, GLTF, camera and WebGL context.
    const element = document.createElement("div");
    hostRef.current = element;
    layer.current?.appendChild(element);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM-owned portal host is created after hydration.
    setHost(element);
    return () => {
      finishRef.current();
      element.remove();
    };
  }, []);
  useLayoutEffect(() => {
    // Docking waits for a usable measurement, so re-check whenever the home
    // viewport is measured or resized, including an animated sidebar collapse.
    const observer = new ResizeObserver(() => dock());
    viewportResize.current = observer;
    return () => {
      observer.disconnect();
      viewportResize.current = null;
      dockedViewport.current = null;
    };
  }, [dock]);
  useLayoutEffect(() => {
    dock();
  }, [dock, reducedMotion]);

  const register = useCallback(
    (route: UniverseRoute, scene: SceneRegistration) => {
      scenes.current.set(route, scene);
      if (run.current) {
        scene.root.inert = true;
        scene.pause();
      }
      dock();
      return () => {
        const owned = scenes.current.get(route) === scene;
        if (owned) scenes.current.delete(route);
        // Park the host before React removes its old page-owned parent. A stale
        // cleanup must never pull it out of a newer registration's viewport, so
        // this acts only on the registration the canvas is actually docked in.
        const host = hostRef.current;
        if (owned && host && scene.root.contains(host)) park(host);
      };
    },
    [dock, park],
  );

  useLayoutEffect(() => {
    path.current = pathname;
    const current = run.current;
    if (current && pathname !== current.from && pathname !== current.to)
      finishRef.current();
    if (!current) dock();
  }, [pathname, dock]);

  // Posts can also be entered or left without the cinematic — a sidebar link, a
  // back button, a hard load. The composition still has to match the route, so
  // the blend is reconciled here and the cinematic simply gets there first.
  useLayoutEffect(() => {
    const first = !stageApplied.current;
    stageApplied.current = true;
    if (run.current) return;
    const target = pathname === "/posts" ? 1 : 0;
    if (Math.abs(stageBlend.current - target) < 1e-4) return;
    // Nothing to travel through on a first paint, and nothing to watch under a
    // reduced-motion preference.
    travelStage(target, first || reducedMotion ? 0 : STAGE_RETURN);
  }, [pathname, reducedMotion, travelStage, stageBlend]);

  // Posts is Earth's destination, so arriving there is what makes Earth the
  // active planet. Once per navigation, never per frame.
  const commitActivePlanet = homeTrack.commitActivePlanet;
  useLayoutEffect(() => {
    if (pathname === "/posts") commitActivePlanet("earth");
  }, [pathname, commitActivePlanet]);

  useLayoutEffect(() => {
    const cancel = () => finishRef.current();
    window.addEventListener("popstate", cancel);
    const resize = () => {
      const destination = run.current?.to;
      const pushed = run.current?.pushed;
      cancel();
      if (destination && !pushed) router.push(destination);
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("popstate", cancel);
      window.removeEventListener("resize", resize);
    };
  }, [router]);

  /**
   * Home to Posts: one continuous scene, not a fade between two pages.
   *
   * Earth is the same WebGL object on both sides — the canvas is portalled into
   * a host that is reparented, never rebuilt — so there is no arrival transform
   * to match and nothing to teleport. The move is a single blend from the loop
   * composition to the Posts composition, with the route pushed part way
   * through it, and the frame loop keeps spinning the Earth and orbiting the
   * Moon throughout.
   */
  const openPosts = useCallback(() => {
    const host = hostRef.current;
    const source = scenes.current.get("/");
    // Without a stage there is nothing to pin, and the canvas would be parked
    // hidden the moment Home unmounts. Let ordinary navigation handle it.
    if (!host || !source || !stage.current) return false;

    const reduced = window.matchMedia(motionQuery).matches;
    const duration = reduced ? REDUCED_TRAVEL : EARTH_TRAVEL;
    const context = gsap.context(() => {});
    const timeline = gsap.timeline({ paused: true });
    const current: Run = {
      from: "/",
      to: "/posts",
      pushed: false,
      reduced,
      timeline,
      context,
      deadline: 0,
      origin: source.root.getBoundingClientRect(),
      overflow: document.body.style.overflow,
      source,
    };
    run.current = current;
    setDirection("home-to-posts");
    shell.current?.setAttribute("data-running", "true");
    // Locks the loop's gestures, the destination controls and a second click on
    // the planet: `isTransitioning` is the one flag the homepage reads.
    source.pause();
    source.root.inert = true;
    router.prefetch("/posts");
    // Hold the scene in the overlay for the whole move. Home's viewport is
    // about to be unmounted from under it, and the overlay rectangle is the
    // pane it already occupies, so nothing moves at the handover.
    layer.current?.appendChild(host);
    host.style.display = "contents";
    pinStage(current.origin);
    // Started outside the run's gsap.context on purpose. A context collects
    // animations created inside the callbacks of animations it owns, and
    // `finish()` reverts it — which would snap the scene back to the home
    // composition at the exact moment it arrives at the Posts one.
    travelStage(1, duration);

    const settle = () => {
      if (run.current !== current) return;
      const destination = scenes.current.get("/posts");
      const ready =
        path.current === "/posts" &&
        destination !== undefined &&
        destination.root.dataset.universeReady !== "false";
      if (!ready && performance.now() < current.deadline) {
        frame.current = requestAnimationFrame(settle);
        return;
      }
      // Docking hands the canvas to the Posts earth layer at exactly the
      // geometry it is already pinned to, so the unpin is not a visual change.
      finishRef.current();
    };

    // One bounded safety timer, not visual sequencing. A failed mount must never
    // leave the page inert or the scene stranded in the overlay. Armed before
    // the timeline so a throw on the way in is covered too.
    watchdog.current = setTimeout(() => {
      if (run.current !== current) return;
      finishRef.current();
      if (!current.pushed) router.push("/posts");
    }, 8000);

    try {
      context.add(() => {
        const chrome =
          source.root.querySelectorAll<HTMLElement>("[data-universe-ui]");
        if (chrome.length)
          timeline.to(chrome, { opacity: 0, duration: duration * 0.4 }, 0);
        timeline.call(
          () => {
            if (run.current !== current) return;
            current.pushed = true;
            router.push("/posts", { scroll: false });
          },
          undefined,
          reduced ? 0 : ROUTE_PUSH_AT,
        );
        // Anchored at 0, not appended: the timeline has to end when Earth
        // finishes travelling, not one route-push offset later.
        timeline.to({}, { duration }, 0);
        timeline.call(
          () => {
            current.deadline = performance.now() + ARRIVAL_TIMEOUT;
            frame.current = requestAnimationFrame(settle);
          },
          undefined,
          duration,
        );
      });
      timeline.play();
    } catch (error) {
      console.error("Universe departure failed", error);
      finishRef.current();
      router.push("/posts");
    }
    return true;
  }, [router, pinStage, travelStage]);

  const navigate = useCallback(
    (href: string) => {
    // A move already owns the scene. Claiming its own destination is what stops
    // a second click from pushing the route twice.
    if (run.current) return href === run.current.to;
    if (pathname === "/" && href === "/posts") return openPosts();
    // Universe Home v1 guard (DECISIONS D09). The legacy Home/Groups cinematic
    // is written against the old orbital feed's anchors, its EarthHandle and
    // body scroll locks, none of which describe the three-planet homepage.
    // Declining here covers both directions and a direct /groups entry alike,
    // because the mode is a module constant rather than state set on first
    // visiting Home. The callers' existing Next Links then navigate normally.
    if (UNIVERSE_HOME_V1_ENABLED) return false;
    if (!(
      (pathname === "/" && href === "/groups") ||
      (pathname === "/groups" && href === "/")
    ))
      return false;
    const host = hostRef.current;
    const source = scenes.current.get(pathname);
    if (!source || !stage.current || !host || !glow.current) return false;
    const forward = href === "/groups";
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const anchor = source.root.querySelector<HTMLElement>(
      "[data-universe-earth]",
    );
    const origin =
      anchor?.getBoundingClientRect() ??
      lastOrigin.current ??
      new DOMRect(innerWidth / 2, innerHeight / 2, innerHeight, innerHeight);
    lastOrigin.current = origin;
    const you = source.root.querySelector("[data-universe-core]");
    const target = you
      ? center(you)
      : {
          x:
            source.root.getBoundingClientRect().left +
            source.root.clientWidth / 2,
          y: innerHeight * 0.55,
        };
    const context = gsap.context(() => {});
    const timeline = gsap.timeline({
      paused: true,
      defaults: { ease: "power3.inOut" },
      onComplete: () => {
        finishRef.current();
        const destination = scenes.current.get(href);
        const focus =
          destination?.root.querySelector<HTMLElement>('h1, [role="region"]') ??
          document.getElementById("app-page-title");
        if (focus) {
          if (!focus.hasAttribute("tabindex"))
            focus.setAttribute("tabindex", "-1");
          focus.focus({ preventScroll: true });
        }
      },
    });
    const current: Run = {
      from: pathname,
      to: href as "/" | "/groups",
      pushed: false,
      reduced,
      timeline,
      context,
      deadline: 0,
      origin,
      overflow: document.body.style.overflow,
      source,
    };
    run.current = current;
    setDirection(forward ? "home-to-groups" : "groups-to-home");
    shell.current?.setAttribute("data-running", "true");
    document.body.style.overflow = "hidden";
    source.pause();
    source.root.inert = true;
    router.prefetch(href);
    layer.current?.appendChild(host);
    host.style.display = reduced ? "none" : "contents";
    if (earth.current) {
      earth.current.motion.speed = 0;
      // Opacity on the DOM canvas does not prevent expensive WebGL draws.
      // Collapse the real object BEFORE waking the renderer for galaxy exit.
      if (!forward) earth.current.group.scale.setScalar(0.025);
      earth.current.group.visible = !reduced || forward;
    }
    gsap.set(stage.current, {
      position: "fixed",
      left: origin.left,
      top: origin.top,
      right: "auto",
      bottom: "auto",
      width: origin.width,
      height: origin.height,
      x: 0,
      y: 0,
      xPercent: 0,
      yPercent: 0,
      transform: "none",
      visibility: "visible",
    });
    gsap.set(glow.current, {
      left: target.x,
      top: target.y,
      opacity: 0,
      scale: 0.3,
    });
    // One bounded safety timer, not visual sequencing. A failed mount must never
    // leave the page inert or body scroll locked.
    watchdog.current = setTimeout(() => {
      if (run.current !== current) return;
      finishRef.current();
      if (!current.pushed) router.push(href);
    }, 8000);
    const push = () => {
      if (run.current !== current) return;
      current.pushed = true;
      shell.current?.setAttribute("data-waiting", current.to);
      router.push(href, { scroll: false });
      current.deadline = performance.now() + 1800;
      frame.current = requestAnimationFrame(awaitDestination);
    };
    const awaitDestination = () => {
      if (run.current !== current) return;
      const destination = scenes.current.get(href);
      if (
        path.current !== href ||
        !destination ||
        (!reduced &&
          destination.root.dataset.universeReady === "false" &&
          performance.now() < current.deadline)
      ) {
        frame.current = requestAnimationFrame(awaitDestination);
        return;
      }
      try {
        destination.pause();
        const at = timeline.duration();
        context.add(() => {
          if (reduced) {
            timeline.from(destination.root, { opacity: 0, duration: 0.16 }, at);
            if (!forward) {
              const homeAnchor = destination.root.querySelector(
                "[data-universe-earth]",
              );
              const rect = homeAnchor?.getBoundingClientRect() ?? origin;
              host.style.display = "contents";
              if (earth.current) {
                earth.current.group.visible = true;
                earth.current.group.position.set(0, 0, 0);
                earth.current.group.scale.setScalar(1);
              }
              gsap.set(stage.current, {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
                x: 0,
                y: 0,
              });
              timeline.fromTo(
                stage.current,
                { opacity: 0 },
                { opacity: 1, duration: 0.16 },
                at,
              );
            }
          } else if (forward) {
            const core = destination.root.querySelector("[data-universe-core]");
            const actual = core ? center(core) : target;
            timeline.to(
              glow.current,
              { left: actual.x, top: actual.y, duration: 0.16 },
              at,
            );
            enterScene(timeline, destination.root, actual, true, at + 0.08);
            timeline.to(
              glow.current,
              { opacity: 0, scale: 0.65, duration: 0.36 },
              at + 0.38,
            );
            timeline.set(stage.current, { opacity: 0 }, at);
          } else {
            const homeAnchor = destination.root.querySelector(
              "[data-universe-earth]",
            );
            const homeRect = homeAnchor?.getBoundingClientRect() ?? origin;
            lastOrigin.current = homeRect;
            gsap.set(stage.current, {
              left: homeRect.left,
              top: homeRect.top,
              width: homeRect.width,
              height: homeRect.height,
              opacity: 1,
            });
            const dx = target.x - (homeRect.left + homeRect.width / 2);
            const dy = target.y - (homeRect.top + homeRect.height / 2);
            const fraction = earth.current ? 0.2 : 0;
            gsap.set(stage.current, {
              x: dx * (1 - fraction),
              y: dy * (1 - fraction),
            });
            if (earth.current) {
              earth.current.group.position.set(
                dx * fraction * earth.current.unitsPerPixel(),
                -dy * fraction * earth.current.unitsPerPixel(),
                0,
              );
              earth.current.group.scale.setScalar(0.025);
            }
            moveEarth(
              timeline,
              stage.current!,
              earth.current,
              homeRect,
              target,
              at + 0.08,
              true,
            );
            timeline.to(
              glow.current,
              { opacity: 0, scale: 2, duration: 0.35 },
              at + 0.08,
            );
            enterScene(timeline, destination.root, target, false, at + 0.55);
          }
        });
        shell.current?.removeAttribute("data-waiting");
        timeline.play();
      } catch (error) {
        console.error("Universe arrival failed", error);
        finishRef.current();
      }
    };
    try {
      context.add(() => {
        if (reduced) {
          // Keep the docked Earth in the fade by fading its persistent stage too.
          host.style.display = forward ? "contents" : "none";
          timeline.to(source.root, { opacity: 0, duration: 0.14 }, 0);
          timeline.to(stage.current, { opacity: 0, duration: 0.14 }, 0);
          timeline.addPause(0.14, push);
        } else {
          exitScene(
            timeline,
            source.root,
            forward ? center(anchor ?? stage.current!) : target,
            forward,
          );
          if (forward) {
            moveEarth(
              timeline,
              stage.current!,
              earth.current,
              origin,
              target,
              0.28,
            );
            if (earth.current)
              timeline.to(
                earth.current.group.scale,
                { x: 0.025, y: 0.025, z: 0.025, duration: 0.28 },
                1.08,
              );
            else
              timeline.to(stage.current, { opacity: 0, duration: 0.28 }, 1.08);
            timeline.to(
              glow.current,
              { opacity: 0.95, scale: 1, duration: 0.28 },
              1.08,
            );
            timeline.addPause(1.36, push);
          } else {
            gsap.set(stage.current, { opacity: 0 });
            timeline.to(
              glow.current,
              { opacity: 0.95, scale: 1, duration: 0.3 },
              0.3,
            );
            timeline.addPause(0.8, push);
          }
        }
      });
      // A pause at the exact end can fire GSAP's onComplete before React mounts
      // the destination. Keep a tiny tail; arrival is appended after that tail.
      timeline.to({}, { duration: 0.001 });
      timeline.play();
    } catch (error) {
      console.error("Universe departure failed", error);
      finishRef.current();
      router.push(href);
    }
    return true;
    },
    [pathname, router, openPosts],
  );

  const onEarthReady = useCallback(
    (handle: EarthHandle | null) => {
      earth.current = handle;
      dock();
    },
    [dock],
  );

  const transitionState: UniverseTransitionState =
    direction ??
    (pathname === "/"
      ? "idle-home"
      : pathname === "/posts"
        ? "idle-posts"
        : "idle-groups");
  // Memoized so home-track updates cannot re-render the Sidebar, Navbar and
  // Groups consumers of the unchanged transition API, and vice versa.
  const transitionApi = useMemo<API>(
    () => ({
      isTransitioning: active,
      transitionState,
      navigate,
      register,
      orbitPosition,
    }),
    [active, transitionState, navigate, register],
  );
  const homeApi = useMemo<UniverseHomeAPI>(
    () => ({
      activePlanetId: homeTrack.activePlanetId,
      selectedPlanetId: homeTrack.selectedPlanetId,
      phase: homeTrack.phase,
      stage: homeTrack.stage,
      scene: homeTrack.scene,
      reducedMotion,
      // One transition machine: this reads the existing coordinator rather than
      // introducing a second transition flag.
      isTransitioning: active,
      commitActivePlanet: homeTrack.commitActivePlanet,
      selectPlanet: homeTrack.selectPlanet,
      setPlanetActivateHandler: homeTrack.setPlanetActivateHandler,
    }),
    [
      homeTrack.activePlanetId,
      homeTrack.selectedPlanetId,
      homeTrack.phase,
      homeTrack.stage,
      homeTrack.scene,
      homeTrack.commitActivePlanet,
      homeTrack.selectPlanet,
      homeTrack.setPlanetActivateHandler,
      reducedMotion,
      active,
    ],
  );
  return (
    <Context.Provider value={transitionApi}>
      <HomeContext.Provider value={homeApi}>
        <div
          ref={shell}
          onClickCapture={(event) => {
            if (
              !run.current ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            const link = (
              event.target as HTMLElement
            ).closest<HTMLAnchorElement>("a[href]");
            if (
              link &&
              link.origin === location.origin &&
              link.pathname !== "/" &&
              link.pathname !== "/groups" &&
              link.pathname !== "/posts"
            )
              finishRef.current();
          }}
          className={styles.shell}
          data-universe-state={transitionState}
        >
          {children}
        </div>
        <UniverseTransitionLayer layerRef={layer} glowRef={glow} />
        {host &&
          (pathname === "/" ||
            pathname === "/groups" ||
            pathname === "/posts" ||
            active) &&
          createPortal(
            // One payload, never both: a second HomeEarth Canvas alongside
            // UniverseCanvas would mean two WebGL contexts on the same route.
            // The mode is a module constant, so this never swaps at runtime.
            UNIVERSE_HOME_V1_ENABLED ? (
              <UniverseCanvasHost
                ref={setStage}
                className={styles.universeStage}
                // Home and Posts draw; Groups keeps the same context but
                // sleeps. This is independent of reduced motion, which stops
                // spin and orbit inside the scene without blanking it.
                renderActive={
                  pathname === "/" || pathname === "/posts" || active
                }
                reducedMotion={reducedMotion}
                phase={homeTrack.phase}
                stage={homeTrack.stage}
                onSceneReady={homeTrack.onSceneReady}
                onPlanetActivate={homeTrack.onPlanetActivate}
              />
            ) : (
              <HomeEarth
                ref={setStage}
                onTransitionReady={onEarthReady}
                transitionActive={active && !reducedMotion}
                renderActive={!reducedMotion && (active || pathname === "/")}
              />
            ),
            host,
          )}
      </HomeContext.Provider>
    </Context.Provider>
  );
}
