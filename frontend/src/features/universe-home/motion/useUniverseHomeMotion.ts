"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type {
  HomeMotionController,
  HomeMotionOptions,
  PlanetId,
  UniverseSceneHandle,
} from "../contracts";
import { PLANET_ORDER } from "../navigation/planetDestinations";
import {
  computeRigX,
  clampProgress,
  getNearestStop,
  getStopForPlanet,
  computeTravelDistance,
} from "./motionMath";

// SSR-safe layout effect
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Hook driving vertical-scroll-driven horizontal planet movement,
 * measured pinning, smooth scrub, nearest-stop snapping, and clean teardown.
 *
 * Owned by Agent 2 (GSAP / Motion Engineer).
 */
export function useUniverseHomeMotion(
  options: HomeMotionOptions,
): HomeMotionController {
  const {
    root,
    viewport,
    scroller,
    scene,
    reducedMotion,
    enabled,
    progressRef,
    onProgress,
  } = options;

  // Internal mutable controller implementation ref
  const controllerImplRef = useRef<HomeMotionController>({
    pause: () => {},
    resume: () => {},
    goToPlanet: () => {},
  });

  // State refs
  const isPausedRef = useRef(false);
  const goToTweenRef = useRef<gsap.core.Tween | null>(null);
  const activeTriggerRef = useRef<ScrollTrigger | null>(null);
  const activeTweenRef = useRef<gsap.core.Tween | null>(null);
  const lastRenderedProgressRef = useRef(0);
  const sceneRef = useRef<UniverseSceneHandle | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);

  // Stable callbacks exposed to consumers
  const pause = useCallback(() => {
    controllerImplRef.current.pause();
  }, []);

  const resume = useCallback(() => {
    controllerImplRef.current.resume();
  }, []);

  const goToPlanet = useCallback((id: PlanetId) => {
    controllerImplRef.current.goToPlanet(id);
  }, []);

  useIsomorphicLayoutEffect(() => {
    const isReady =
      enabled &&
      root !== null &&
      viewport !== null &&
      scroller !== null &&
      scene !== null;

    if (!isReady) {
      // Inactive/not-ready: return safe no-op controller
      controllerImplRef.current = {
        pause: () => {},
        resume: () => {},
        goToPlanet: () => {},
      };
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    sceneRef.current = scene;
    scrollerRef.current = scroller;
    const scrollEl = scroller;

    const planetOrder: readonly PlanetId[] = PLANET_ORDER;
    const numDestinations = planetOrder.length;

    // Helper: update rig positions for all planets along the track
    const applyRigPositions = (p: number, spacing: number) => {
      const activeScene = sceneRef.current ?? scene;
      if (!activeScene) return;
      for (let i = 0; i < planetOrder.length; i++) {
        const id = planetOrder[i];
        const rig = activeScene.rigs.get(id);
        if (rig && rig.scrollRoot) {
          rig.scrollRoot.position.x = computeRigX(
            p,
            i,
            numDestinations,
            spacing,
          );
        }
      }
    };

    // 1. Initial restoration of saved progress before ordinary updates
    const initialProgress = clampProgress(progressRef.current ?? 0);
    lastRenderedProgressRef.current = initialProgress;
    applyRigPositions(initialProgress, scene.spacing);
    scene.invalidate();
    onProgress(initialProgress);

    // Measure travel distance based on viewport height
    let travelDistance = computeTravelDistance(
      viewport.clientHeight,
      numDestinations,
    );

    // Align initial scroll position to saved progress
    const initialScroll = Math.round(initialProgress * travelDistance);
    scrollEl.scrollTo({ top: initialScroll, behavior: "instant" });

    // 2. Scoped GSAP Context
    const ctx = gsap.context(() => {
      if (!reducedMotion) {
        // Standard cinematic motion: smooth scrub + nearest stop snap
        const playhead = { progress: initialProgress };

        const tween = gsap.fromTo(
          playhead,
          { progress: 0 },
          {
            progress: 1,
            ease: "none",
            immediateRender: false,
            onUpdate: () => {
              if (isPausedRef.current) return;
              const p = clampProgress(playhead.progress);
              lastRenderedProgressRef.current = p;
              progressRef.current = p;
              applyRigPositions(p, sceneRef.current?.spacing ?? scene.spacing);
              sceneRef.current?.invalidate();
              onProgress(p);
            },
            scrollTrigger: {
              trigger: root,
              pin: viewport,
              scroller,
              start: "top top",
              end: () => `+=${travelDistance}`,
              scrub: 0.8,
              pinSpacing: true,
              invalidateOnRefresh: true,
              snap:
                numDestinations > 1
                  ? {
                      snapTo: 1 / (numDestinations - 1),
                      duration: { min: 0.25, max: 0.5 },
                      ease: "power1.inOut",
                      directional: false,
                      inertia: false,
                    }
                  : undefined,
              onRefresh: () => {
                if (isPausedRef.current) return;
                const p = clampProgress(progressRef.current);
                applyRigPositions(
                  p,
                  sceneRef.current?.spacing ?? scene.spacing,
                );
                sceneRef.current?.invalidate();
              },
            },
          },
        );

        const trigger = tween.scrollTrigger!;
        activeTriggerRef.current = trigger;
        activeTweenRef.current = tween;

        // Position playhead and trigger to restored progress
        tween.progress(initialProgress);
        playhead.progress = initialProgress;
        trigger.scroll(initialScroll);
        trigger.update();
      } else {
        // Reduced motion: discrete nearest-stop placement from vertical progression, no smooth scrub or snap
        let currentDiscreteStop = getNearestStop(
          initialProgress,
          numDestinations,
        );

        const trigger = ScrollTrigger.create({
          trigger: root,
          pin: viewport,
          scroller,
          start: "top top",
          end: () => `+=${travelDistance}`,
          pinSpacing: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (isPausedRef.current) return;
            const discreteProgress = getNearestStop(
              self.progress,
              numDestinations,
            );
            if (discreteProgress !== currentDiscreteStop) {
              currentDiscreteStop = discreteProgress;
              lastRenderedProgressRef.current = discreteProgress;
              progressRef.current = discreteProgress;
              applyRigPositions(
                discreteProgress,
                sceneRef.current?.spacing ?? scene.spacing,
              );
              sceneRef.current?.invalidate();
              onProgress(discreteProgress);
            }
          },
          onRefresh: () => {
            if (isPausedRef.current) return;
            const p = getNearestStop(progressRef.current, numDestinations);
            applyRigPositions(p, sceneRef.current?.spacing ?? scene.spacing);
            sceneRef.current?.invalidate();
          },
        });

        activeTriggerRef.current = trigger;
        trigger.scroll(initialScroll);
        trigger.update();
      }
    }, root);

    // 3. User scroll detection to interrupt programmatic goToPlanet
    const handleUserScroll = () => {
      if (goToTweenRef.current) {
        goToTweenRef.current.kill();
        goToTweenRef.current = null;
      }
    };
    scroller.addEventListener("wheel", handleUserScroll, { passive: true });
    scroller.addEventListener("touchstart", handleUserScroll, {
      passive: true,
    });
    scroller.addEventListener("pointerdown", handleUserScroll, {
      passive: true,
    });

    // 4. Controller methods implementation
    controllerImplRef.current = {
      pause: () => {
        if (isPausedRef.current) return;
        isPausedRef.current = true;
        if (goToTweenRef.current) {
          goToTweenRef.current.pause();
        }
        activeTriggerRef.current?.disable(false, false);
      },
      resume: () => {
        if (!isPausedRef.current) return;
        isPausedRef.current = false;
        activeTriggerRef.current?.enable(false, false);

        const currentP = clampProgress(progressRef.current);
        scroller.scrollTo({
          top: Math.round(currentP * travelDistance),
          behavior: "instant",
        });

        if (activeTweenRef.current) {
          activeTweenRef.current.progress(currentP);
        }
        activeTriggerRef.current?.scroll(scroller.scrollTop);
        activeTriggerRef.current?.update();

        applyRigPositions(currentP, sceneRef.current?.spacing ?? scene.spacing);
        sceneRef.current?.invalidate();
        onProgress(currentP);
      },
      goToPlanet: (id: PlanetId) => {
        if (isPausedRef.current) return;
        const targetProgress = getStopForPlanet(id, planetOrder);
        const targetScroll = Math.round(targetProgress * travelDistance);

        if (goToTweenRef.current) {
          goToTweenRef.current.kill();
          goToTweenRef.current = null;
        }

        if (reducedMotion) {
          scroller.scrollTo({ top: targetScroll, behavior: "instant" });
          lastRenderedProgressRef.current = targetProgress;
          progressRef.current = targetProgress;
          applyRigPositions(
            targetProgress,
            sceneRef.current?.spacing ?? scene.spacing,
          );
          sceneRef.current?.invalidate();
          onProgress(targetProgress);
          activeTriggerRef.current?.update();
        } else {
          goToTweenRef.current = gsap.to(scroller, {
            scrollTop: targetScroll,
            duration: 0.8,
            ease: "power2.inOut",
            overwrite: "auto",
            onComplete: () => {
              goToTweenRef.current = null;
            },
          });
        }
      },
    };

    // 5. Batched Resize & Sidebar animation handling
    let resizeRaf = 0;
    const handleResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        if (isPausedRef.current) return;
        const currentP = clampProgress(progressRef.current);
        travelDistance = computeTravelDistance(
          viewport.clientHeight,
          numDestinations,
        );

        // Keep scroll position synchronized to normalized progress
        scroller.scrollTo({
          top: Math.round(currentP * travelDistance),
          behavior: "instant",
        });

        // Refresh trigger metrics and bounds
        activeTriggerRef.current?.refresh();
        activeTriggerRef.current?.update();

        // Recompute world positions with latest scene spacing
        const latestSpacing = sceneRef.current?.spacing ?? scene.spacing;
        applyRigPositions(currentP, latestSpacing);
        sceneRef.current?.invalidate();
      });
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(scroller);
    resizeObserver.observe(viewport);

    const handleTransitionEnd = (event: TransitionEvent) => {
      if (
        event.propertyName === "margin-left" ||
        event.propertyName === "transform" ||
        event.propertyName === "width"
      ) {
        handleResize();
      }
    };
    window.addEventListener("transitionend", handleTransitionEnd);

    // 6. Cleanup on unmount or dependency changes
    return () => {
      cancelAnimationFrame(resizeRaf);
      resizeObserver.disconnect();
      window.removeEventListener("transitionend", handleTransitionEnd);

      scroller.removeEventListener("wheel", handleUserScroll);
      scroller.removeEventListener("touchstart", handleUserScroll);
      scroller.removeEventListener("pointerdown", handleUserScroll);

      if (goToTweenRef.current) {
        goToTweenRef.current.kill();
        goToTweenRef.current = null;
      }

      activeTriggerRef.current = null;
      activeTweenRef.current = null;

      // Revert only our own GSAP context
      ctx.revert();

      // Reset controller methods to safe no-ops
      controllerImplRef.current = {
        pause: () => {},
        resume: () => {},
        goToPlanet: () => {},
      };
    };
  }, [
    root,
    viewport,
    scroller,
    scene,
    reducedMotion,
    enabled,
    progressRef,
    onProgress,
  ]);

  return { pause, resume, goToPlanet };
}
