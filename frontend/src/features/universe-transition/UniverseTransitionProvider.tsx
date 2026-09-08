"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
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
  const stage = useRef<HTMLDivElement>(null);
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

  const dock = useCallback(() => {
    const host = hostRef.current;
    if (!host || !stage.current || run.current) return;
    const home = scenes.current.get("/");
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
  }, []);

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
        if (scenes.current.get(route) === scene) scenes.current.delete(route);
        // Move the host before React removes its old page-owned parent.
        if (route === "/" && hostRef.current)
          layer.current?.appendChild(hostRef.current);
      };
    },
    [dock],
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

  function navigate(href: string) {
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
        const focus = destination?.root.querySelector<HTMLElement>(
          'h1, [role="region"]',
        );
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
  }

  const onEarthReady = useCallback(
    (handle: EarthHandle | null) => {
      earth.current = handle;
      dock();
    },
    [dock],
  );

  const transitionState: UniverseTransitionState =
    direction ?? (pathname === "/" ? "idle-home" : "idle-groups");
  return (
    <Context.Provider
      value={{
        isTransitioning: active,
        transitionState,
        navigate,
        register,
        homePosition,
      }}
    >
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
          <HomeEarth
            ref={stage}
            onTransitionReady={onEarthReady}
            transitionActive={active && !reducedMotion}
            renderActive={!reducedMotion && (active || pathname === "/")}
          />,
          host,
        )}
    </Context.Provider>
  );
}
