"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "gsap";
import { copyPose, createCameraRig, type CameraRig } from "./cameraPose";
import {
  compositionLayout,
  destinationForRoute,
  REDUCED_TIMING,
  TRAVEL_TIMING,
  UNIVERSE_DESTINATIONS,
  type CompositionLayout,
  type UniverseDestinationId,
} from "./destinations";

/**
 * Where the universe is, as far as the page UI is concerned.
 *
 * `destination` is where the camera is, or where it is heading. `phase` is the
 * part of a move that decides what the UI may show:
 *
 * - `departing` — the camera is travelling; no destination's UI is visible.
 * - `arriving`  — the camera has settled; the destination's UI is fading in,
 *                 and input stays locked until it has.
 * - `idle`      — nothing is moving.
 */
export type UniverseView = {
  destination: UniverseDestinationId;
  phase: "idle" | "departing" | "arriving";
};

type NavigationAPI = {
  view: UniverseView;
  isTransitioning: boolean;
  /** Which overlay layout matches the camera composition for this pane. */
  layout: CompositionLayout;
  /** Handles navigation between two routes of the persistent universe with a
   * camera move. Returns false for anything else, which the caller should
   * navigate normally. */
  navigate: (href: string) => boolean;
};

type SceneAPI = {
  /** A mutable store, not state: the timeline writes it and the camera reads it
   * every frame, and neither may cost a render. */
  rigRef: RefObject<CameraRig>;
  bindSceneLayer: (element: HTMLElement | null) => void;
  reportPane: (width: number, height: number) => void;
};

const NavigationContext = createContext<NavigationAPI | null>(null);
const SceneContext = createContext<SceneAPI | null>(null);

export function useUniverseNavigation(): NavigationAPI {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("UniverseNavigationProvider is required");
  return value;
}

/** Stable for the life of the app: the scene layer reads it without being
 * re-rendered by every phase change of a move. */
export function useUniverseScene(): SceneAPI {
  const value = useContext(SceneContext);
  if (!value) throw new Error("UniverseNavigationProvider is required");
  return value;
}

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** How long a move waits for its own route push to land before it stops
 * trusting it and brings the camera back into line with the URL. Generous,
 * because a first visit in development compiles the route on demand. */
const ROUTE_WATCHDOG = 8000;

type Run = { to: UniverseDestinationId; timeline: gsap.core.Timeline };

/**
 * The universe navigation coordinator.
 *
 * It lives in the app shell, above every route, and owns three things: the
 * camera rig the persistent scene reads, the `view` the page overlays read, and
 * the single GSAP timeline that moves both. A move is:
 *
 *   0.00  destination set → the current page's UI fades (useDestinationPresence)
 *   0.10  camera starts travelling (rig.progress 0 → 1)
 *   0.40  route pushed, behind UI that is already invisible
 *   1.80  camera settled → the destination's UI fades in
 *   2.14  idle, input unlocked
 *
 * The route is a consequence of the move, not its trigger, so it also works the
 * other way round: when the URL changes without a move — Back, Forward, a link —
 * the camera is brought to the route's destination by the same timeline.
 */
export default function UniverseNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const rigRef = useRef<CameraRig>(null!);
  if (rigRef.current === null) {
    rigRef.current = createCameraRig(destinationForRoute(pathname) ?? "home");
  }
  const [view, setView] = useState<UniverseView>(() => ({
    destination: destinationForRoute(pathname) ?? "home",
    phase: "idle",
  }));
  const [layout, setLayout] = useState<CompositionLayout>("side");

  const run = useRef<Run | null>(null);
  const layer = useRef<HTMLElement | null>(null);
  const path = useRef(pathname);
  const pending = useRef<{
    route: string;
    watchdog: ReturnType<typeof setTimeout>;
  } | null>(null);
  /** Set while the app is on a route without the scene. The next universe route
   * starts settled at its destination: there is no camera to fly from. */
  const detached = useRef(destinationForRoute(pathname) === null);
  const reconcileRef = useRef<() => void>(() => {});

  const clearPending = useCallback(() => {
    if (!pending.current) return;
    clearTimeout(pending.current.watchdog);
    pending.current = null;
  }, []);

  const stop = useCallback(() => {
    const current = run.current;
    if (!current) return;
    run.current = null;
    current.timeline.kill();
    if (layer.current) gsap.set(layer.current, { clearProps: "opacity" });
  }, []);

  const travel = useCallback(
    (to: UniverseDestinationId, push: boolean) => {
      const rig = rigRef.current;
      if (run.current) {
        // Interrupted — only history navigation can do this, since the UI is
        // inert during a move. Start from the pose the camera is really in.
        stop();
        copyPose(rigRef.current.current, rigRef.current.snapshot);
        rigRef.current.from = "snapshot";
      } else {
        rigRef.current.from = rigRef.current.to;
      }
      rigRef.current.to = to;
      rigRef.current.progress = 0;
      setView({ destination: to, phase: "departing" });

      const route = UNIVERSE_DESTINATIONS[to].route;
      if (push) router.prefetch(route);
      const reduced = window.matchMedia(MOTION_QUERY).matches;

      const timeline = gsap.timeline({
        onComplete: () => {
          if (run.current?.timeline !== timeline) return;
          run.current = null;
          setView({ destination: to, phase: "idle" });
        },
      });
      run.current = { to, timeline };

      const pushRoute = () => {
        if (!push || path.current === route) return;
        clearPending();
        pending.current = {
          route,
          watchdog: setTimeout(() => {
            pending.current = null;
            reconcileRef.current();
          }, ROUTE_WATCHDOG),
        };
        router.push(route, { scroll: false });
      };
      const arrive = () => setView({ destination: to, phase: "arriving" });

      if (reduced) {
        const timing = REDUCED_TIMING;
        const scene = layer.current;
        if (scene)
          timeline.to(
            scene,
            { opacity: 0, duration: timing.sceneOut, ease: "power1.out" },
            0,
          );
        timeline.call(
          () => {
            rigRef.current.progress = 1;
            rigRef.current.invalidate();
            pushRoute();
          },
          undefined,
          timing.cutAt,
        );
        if (scene)
          timeline.to(
            scene,
            {
              opacity: 1,
              duration: timing.sceneIn,
              ease: "power1.in",
              clearProps: "opacity",
            },
            timing.cutAt,
          );
        const arriveAt = timing.cutAt + timing.sceneIn;
        timeline.call(arrive, undefined, arriveAt);
        timeline.to({}, { duration: timing.uiIn }, arriveAt);
      } else {
        const timing = TRAVEL_TIMING;
        timeline.to(
          rig,
          {
            progress: 1,
            duration: timing.camera,
            // Linear on purpose: position, aim and lens each apply their own
            // curve to this number (`cameraPose.blendPoses`).
            ease: "none",
            onUpdate: () => rigRef.current.invalidate(),
          },
          timing.cameraStart,
        );
        timeline.call(pushRoute, undefined, timing.routeAt);
        const arriveAt = timing.cameraStart + timing.camera;
        timeline.call(arrive, undefined, arriveAt);
        timeline.to({}, { duration: timing.uiIn }, arriveAt);
      }
      return true;
    },
    [router, stop, clearPending],
  );

  /** Brings the camera into line with the current URL. */
  const reconcile = useCallback(() => {
    const current = path.current;
    const target = destinationForRoute(current);
    if (target === null) {
      // The scene unmounts with this route; whatever it was doing is moot.
      stop();
      clearPending();
      detached.current = true;
      setView((previous) =>
        previous.phase === "idle" ? previous : { ...previous, phase: "idle" },
      );
      return;
    }
    if (pending.current) {
      // Our own push has not landed yet. The URL is behind the camera, not the
      // other way round, so there is nothing to correct.
      if (pending.current.route !== current) return;
      clearPending();
    }
    if (detached.current) {
      detached.current = false;
      stop();
      rigRef.current.from = target;
      rigRef.current.to = target;
      rigRef.current.progress = 1;
      rigRef.current.invalidate();
      setView({ destination: target, phase: "idle" });
      return;
    }
    if ((run.current?.to ?? rigRef.current.to) !== target)
      travel(target, false);
  }, [stop, clearPending, travel]);

  useLayoutEffect(() => {
    path.current = pathname;
    reconcileRef.current = reconcile;
    reconcile();
  }, [pathname, reconcile]);

  useEffect(
    () => () => {
      stop();
      clearPending();
    },
    [stop, clearPending],
  );

  const navigate = useCallback(
    (href: string) => {
      const to = destinationForRoute(href);
      if (to === null || destinationForRoute(path.current) === null)
        return false;
      // A move already owns the camera. Claiming the request is what stops a
      // second click from starting another one or pushing a second route.
      if (run.current) return true;
      if (to === rigRef.current.to) {
        if (path.current !== href) router.push(href, { scroll: false });
        return true;
      }
      return travel(to, true);
    },
    [router, travel],
  );

  const bindSceneLayer = useCallback((element: HTMLElement | null) => {
    layer.current = element;
  }, []);
  const reportPane = useCallback((width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    setLayout(compositionLayout(width / height));
  }, []);

  const navigation = useMemo<NavigationAPI>(
    () => ({
      view,
      isTransitioning: view.phase !== "idle",
      layout,
      navigate,
    }),
    [view, layout, navigate],
  );
  const scene = useMemo<SceneAPI>(
    () => ({ rigRef, bindSceneLayer, reportPane }),
    [bindSceneLayer, reportPane],
  );

  return (
    <SceneContext.Provider value={scene}>
      <NavigationContext.Provider value={navigation}>
        {children}
      </NavigationContext.Provider>
    </SceneContext.Provider>
  );
}
