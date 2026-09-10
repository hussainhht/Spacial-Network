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
import type {
  EarthHandle,
  SceneRegistration,
  UniverseTransitionState,
} from "./types";
import styles from "./UniverseTransition.module.css";

const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

type API = {
  isTransitioning: boolean;
  transitionState: UniverseTransitionState;
  navigate: (href: string) => boolean;
  register: (route: "/" | "/groups", scene: SceneRegistration) => () => void;
  homePosition: { current: number };
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
  to: "/" | "/groups";
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
    "home-to-groups" | "groups-to-home" | null
  >(null);
  const active = direction !== null;
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const homeViewport = useRef<HTMLElement | null>(null);
  const viewportResize = useRef<ResizeObserver | null>(null);
  const glow = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const earth = useRef<EarthHandle | null>(null);
  const scenes = useRef(new Map<string, SceneRegistration>());
  const run = useRef<Run | null>(null);
  const frame = useRef(0);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homePosition = useRef(0);
  const path = useRef(pathname);
  const lastOrigin = useRef<DOMRect | null>(null);
  const finishRef = useRef<() => void>(() => {});
  // The universe home loop: active/selected planet, the continuous loop phase
  // and the scene readiness snapshot. Deliberately separate from the legacy
  // `homePosition` ref above, which stores the old feed's post playhead.
  const homeTrack = useUniverseHomeState(pathname);

  const park = useCallback((host: HTMLDivElement) => {
    if (host.parentElement !== layer.current) layer.current?.appendChild(host);
    host.style.display = "contents";
    if (stage.current) stage.current.style.visibility = "hidden";
  }, []);

  const dock = useCallback(() => {
    const host = hostRef.current;
    if (!host || run.current) return;
    const home = scenes.current.get("/");
    if (UNIVERSE_HOME_V1_ENABLED) {
      // The v1 home owns a measured viewport inside its registered root, and
      // the Canvas sizes itself from that box. Docking into a 0x0 parent would
      // publish an unusable scene handle, so wait for a real measurement.
      const viewport =
        path.current === "/"
          ? (home?.root.querySelector<HTMLElement>("[data-universe-viewport]") ??
            null)
          : null;
      if (homeViewport.current !== viewport) {
        if (homeViewport.current)
          viewportResize.current?.unobserve(homeViewport.current);
        homeViewport.current = viewport;
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
    shell.current?.removeAttribute("data-waiting");
    shell.current?.removeAttribute("data-running");
    for (const scene of scenes.current.values()) {
      scene.root.inert = false;
      scene.resume();
    }
    if (glow.current) gsap.set(glow.current, { opacity: 0 });
    setDirection(null);
    dock();
  }, [dock]);
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
      homeViewport.current = null;
    };
  }, [dock]);
  useLayoutEffect(() => {
    dock();
  }, [dock, reducedMotion]);

  const register = useCallback(
    (route: "/" | "/groups", scene: SceneRegistration) => {
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
        // cleanup must never pull it out of a newer registration's viewport.
        if (route === "/" && owned && hostRef.current) park(hostRef.current);
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

  const navigate = useCallback(
    (href: string) => {
    // Universe Home v1 guard (DECISIONS D09). The legacy cinematic is written
    // against the old orbital feed's anchors, its EarthHandle and body scroll
    // locks, none of which describe the three-planet homepage. Declining here
    // covers both directions and a direct /groups entry alike, because the mode
    // is a module constant rather than state set on first visiting Home. The
    // callers' existing Next Links then navigate normally.
    if (UNIVERSE_HOME_V1_ENABLED) return false;
    if (run.current) return href === "/" || href === "/groups";
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
    [pathname, router],
  );

  const onEarthReady = useCallback(
    (handle: EarthHandle | null) => {
      earth.current = handle;
      dock();
    },
    [dock],
  );

  const transitionState: UniverseTransitionState =
    direction ?? (pathname === "/" ? "idle-home" : "idle-groups");
  // Memoized so home-track updates cannot re-render the Sidebar, Navbar and
  // Groups consumers of the unchanged transition API, and vice versa.
  const transitionApi = useMemo<API>(
    () => ({
      isTransitioning: active,
      transitionState,
      navigate,
      register,
      homePosition,
    }),
    [active, transitionState, navigate, register],
  );
  const homeApi = useMemo<UniverseHomeAPI>(
    () => ({
      activePlanetId: homeTrack.activePlanetId,
      selectedPlanetId: homeTrack.selectedPlanetId,
      phase: homeTrack.phase,
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
            const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
              "a[href]",
            );
            if (
              link &&
              link.origin === location.origin &&
              link.pathname !== "/" &&
              link.pathname !== "/groups"
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
          (pathname === "/" || pathname === "/groups" || active) &&
          createPortal(
            // One payload, never both: a second HomeEarth Canvas alongside
            // UniverseCanvas would mean two WebGL contexts on the same route.
            // The mode is a module constant, so this never swaps at runtime.
            UNIVERSE_HOME_V1_ENABLED ? (
              <UniverseCanvasHost
                ref={setStage}
                className={styles.universeStage}
                // Home draws; Groups keeps the same context but sleeps. This is
                // independent of reduced motion, which stops spin and orbit
                // inside the scene without blanking it.
                renderActive={pathname === "/" || active}
                reducedMotion={reducedMotion}
                phase={homeTrack.phase}
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
