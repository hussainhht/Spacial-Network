"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import type { PostView } from "./ExpandedPost";
import earthStyles from "@/components/space/HomeEarth.module.css";
import { useUniverseTransition } from "@/features/universe-transition/UniverseTransitionProvider";
import { listPosts } from "../../api/posts";
import type { Post } from "../../types/post";
import { ApiError } from "@/lib/api/errors";
import OrbitalPost from "./OrbitalPost";
import styles from "./HomeOrbitalFeed.module.css";

const FRONT_ANGLE = 2.45;
const ANGLE_STEP = 0.95;

type Selection = { id: number; expanded: boolean; view: PostView };

gsap.registerPlugin(ScrollTrigger, Flip);

export default function HomeOrbitalFeed() {
  const router = useRouter();
  const { register, homePosition } = useUniverseTransition();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [request, setRequest] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const selectionRef = useRef<Selection | null>(null);
  const frozenRef = useRef(false);
  const transitioningRef = useRef(false);
  const surfaceRefs = useRef(new Map<number, HTMLDivElement>());
  const flipStateRef = useRef<ReturnType<typeof Flip.getState> | null>(null);
  const flipContextRef = useRef<gsap.Context | null>(null);
  const orbitControlRef = useRef({ pause: () => {}, resume: () => {} });
  const savedScrollRef = useRef(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const focusFrameRef = useRef(0);
  // Content edits do not rebuild the orbital animation.
  const orbitKey = posts.map((post) => post.id).join(",");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const earthRef = useRef<HTMLDivElement>(null);
  const postRefs = useRef(new Map<number, HTMLDivElement>());
  const counterRef = useRef<HTMLSpanElement>(null);
  const previousRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const navigateRef = useRef<(direction: number) => void>(() => {});
  // Keep the same post in view when an earlier/current card is deleted.
  const positionRef = useRef(homePosition.current);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(() => {
      scroller.style.setProperty(
        "--focus-height",
        `${scroller.clientHeight}px`,
      );
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await listPosts();
        if (!cancelled) setPosts(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          router.push("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load posts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router, request]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    const scene = sceneRef.current;
    const earth = earthRef.current;
    if (!scroller || !track || !scene || !earth || !orbitKey) return;
    const postIds = orbitKey.split(",").map(Number);

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();

    // matchMedia owns a scoped GSAP context, including its ScrollTrigger.
    media.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const cards = postIds.flatMap((id, index) => {
          const element = postRefs.current.get(id);
          if (!element) return [];
          gsap.set(element, { xPercent: -50, yPercent: -50 });
          return [
            {
              element,
              index,
              x: gsap.quickSetter(element, "x", "px"),
              y: gsap.quickSetter(element, "y", "px"),
              scale: gsap.quickSetter(element, "scale"),
              opacity: gsap.quickSetter(element, "opacity"),
            },
          ];
        });
        const lastIndex = postIds.length - 1;
        const initialPosition = Math.min(positionRef.current, lastIndex);
        const playhead = { position: initialPosition };
        let scrollPerPost = 900;
        let centerX = 0;
        let centerY = 0;
        let radiusX = 0;
        let radiusY = 0;
        let tilt = 0;

        function measure() {
          const width = scroller!.clientWidth;
          const height = scroller!.clientHeight;
          scroller!.style.setProperty("--scene-height", `${height}px`);
          scrollPerPost = Math.max(800, height * 1.2);
          track!.style.height = `${height + lastIndex * scrollPerPost}px`;

          const bounds = scene!.getBoundingClientRect();
          const earthBounds = earth!.getBoundingClientRect();
          const compact = width < 640;
          const cardWidth = Math.min(360, width - 32);
          const activeX = compact
            ? width / 2
            : Math.max(cardWidth / 2 + 28, width * 0.46);
          // Measure the existing Earth; never move it to fit the cards.
          centerX = compact
            ? width * 0.9
            : earthBounds.left + earthBounds.width / 2 - bounds.left;
          radiusX = Math.max(60, (centerX - activeX) / -Math.cos(FRONT_ANGLE));
          radiusY = height * (compact ? 0.31 : 0.35);
          tilt = compact ? 0.06 : 0.12;
          // Project a tilted ellipse across the visible part of the large Earth.
          centerY =
            height * 0.6 -
            radiusY * Math.sin(FRONT_ANGLE) -
            tilt * radiusX * Math.cos(FRONT_ANGLE);
        }

        function render() {
          if (frozenRef.current) return;
          positionRef.current = playhead.position;
          homePosition.current = playhead.position;
          const active = Math.round(playhead.position);
          for (const card of cards) {
            const offset = card.index - playhead.position;
            // A five-card window: old posts leave on the right; new ones enter above.
            const visible = offset > -2 && offset < 3;
            card.element.style.visibility = visible ? "visible" : "hidden";
            const interactive = visible && card.index === active;
            if (!interactive && card.element.contains(document.activeElement)) {
              scroller!.focus({ preventScroll: true });
            }
            card.element.inert = !interactive;
            card.element.setAttribute("aria-hidden", String(!interactive));
            card.element.style.pointerEvents = interactive ? "auto" : "none";
            card.element.dataset.active = String(interactive);
            if (!visible) continue;

            const angle = FRONT_ANGLE + offset * ANGLE_STEP;
            // Cross behind at the planet's centerline, while the card is still
            // visible in the viewport. Keep the reading focus on FRONT_ANGLE.
            const depth = -Math.cos(angle);
            const nearness =
              ((Math.cos(offset * ANGLE_STEP) + 1) / 2) *
              gsap.utils.clamp(0, 1, (depth + 0.18) / 0.8);
            const fade = Math.min(1, (offset + 2) / 0.25, (3 - offset) / 0.5);
            card.x(centerX + radiusX * Math.cos(angle));
            card.y(
              centerY +
                radiusY * Math.sin(angle) +
                tilt * radiusX * Math.cos(angle),
            );
            card.scale(0.74 + 0.26 * nearness ** 3);
            card.opacity((0.45 + 0.55 * nearness ** 2) * fade);
            // Earth is layer 20. Its transparent canvas genuinely occludes back cards.
            card.element.style.zIndex = String(
              depth > 0 ? 30 + Math.round(nearness * 10) : 10,
            );
          }
          if (counterRef.current)
            counterRef.current.textContent = `${active + 1} / ${postIds.length}`;
          if (previousRef.current) previousRef.current.disabled = active === 0;
          if (nextRef.current) nextRef.current.disabled = active === lastIndex;
        }

        measure();
        render();
        const tween = gsap.fromTo(
          playhead,
          { position: 0 },
          {
            position: lastIndex,
            ease: "none",
            immediateRender: false,
            onUpdate: render,
            scrollTrigger: {
              trigger: track,
              scroller,
              start: "top top",
              end: () => `+=${Math.max(1, lastIndex * scrollPerPost)}`,
              scrub: true,
              invalidateOnRefresh: true,
              onRefresh: render,
            },
          },
        );
        const trigger = tween.scrollTrigger!;
        scroller.scrollTop = initialPosition * scrollPerPost;
        trigger.update();

        navigateRef.current = (direction) => {
          if (frozenRef.current) return;
          const target = gsap.utils.clamp(
            0,
            lastIndex,
            Math.round(playhead.position) + direction,
          );
          scroller.scrollTo({
            top: target * scrollPerPost,
            behavior: "instant",
          });
        };

        let resizeFrame = 0;
        let resizePending = false;
        orbitControlRef.current = {
          pause: () => trigger.disable(false, false),
          resume: () => {
            const position = Math.min(positionRef.current, lastIndex);
            if (resizePending) measure();
            scroller.scrollTop = position * scrollPerPost;
            trigger.enable(false, false);
            if (resizePending) trigger.refresh();
            tween.progress(lastIndex ? position / lastIndex : 0);
            playhead.position = position;
            trigger.update();
            frozenRef.current = false;
            resizePending = false;
            render();
          },
        };
        // Handles a motion-preference change while a post is open.
        if (frozenRef.current) trigger.disable(false, false);
        const observer = new ResizeObserver(() => {
          cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
            if (frozenRef.current) {
              resizePending = true;
              return;
            }
            const position = positionRef.current;
            measure();
            scroller.scrollTop = position * scrollPerPost;
            trigger.refresh();
            trigger.update();
            render();
          });
        });
        observer.observe(scroller);
        observer.observe(earth);

        return () => {
          observer.disconnect();
          cancelAnimationFrame(resizeFrame);
          navigateRef.current = () => {};
          orbitControlRef.current = { pause: () => {}, resume: () => {} };
          scroller.style.removeProperty("--scene-height");
          track.style.removeProperty("height");
          for (const { element } of cards) {
            element.inert = false;
            element.removeAttribute("aria-hidden");
            element.removeAttribute("data-active");
            // quickSetter writes are not tweens, so restore them explicitly.
            element.removeAttribute("style");
          }
        };
      },
      scene,
    );

    return () => media.revert();
  }, [orbitKey, homePosition]);

  const focusPost = useCallback((id: number, view: PostView) => {
    const surface = surfaceRefs.current.get(id);
    const target = surface?.querySelector<HTMLElement>(
      view === "comments"
        ? "[data-post-comments]"
        : view === "edit"
          ? "[data-edit-post] input"
          : "[data-close-post]",
    );
    target?.focus({ preventScroll: true });
    const scroll = surface?.querySelector<HTMLElement>("[data-post-scroll]");
    if (scroll && target) {
      scroll.scrollTop =
        view === "post"
          ? 0
          : scroll.scrollTop +
            target.getBoundingClientRect().top -
            scroll.getBoundingClientRect().top;
    }
  }, []);

  const scheduleFocus = useCallback(
    (id: number, view: PostView) => {
      cancelAnimationFrame(focusFrameRef.current);
      focusFrameRef.current = requestAnimationFrame(() => {
        if (selectionRef.current?.id === id && selectionRef.current.expanded)
          focusPost(id, view);
      });
    },
    [focusPost],
  );

  function openPost(id: number, view: PostView) {
    if (transitioningRef.current) return;
    if (selectionRef.current) {
      if (selectionRef.current.id !== id) return;
      const next = { id, expanded: true, view };
      selectionRef.current = next;
      setSelection(next);
      scheduleFocus(id, view);
      return;
    }
    const surface = surfaceRefs.current.get(id);
    const scroller = scrollerRef.current;
    if (!surface || !scroller) return;
    orbitControlRef.current.pause();
    frozenRef.current = true;
    savedScrollRef.current = scroller.scrollTop;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement &&
      surface.contains(document.activeElement)
        ? document.activeElement
        : surface.querySelector("button");
    const offset = Math.max(
      0,
      scroller.getBoundingClientRect().top -
        (sceneRef.current?.getBoundingClientRect().top ?? 0),
    );
    scroller.style.setProperty("--focus-offset", `${offset}px`);
    scroller.style.setProperty(
      "--selected-orbit-height",
      `${surface.offsetHeight}px`,
    );
    flipStateRef.current = Flip.getState(surface);
    const next = { id, expanded: true, view };
    selectionRef.current = next;
    transitioningRef.current = true;
    setTransitioning(true);
    setSelection(next);
  }

  const closePost = useCallback(() => {
    const selected = selectionRef.current;
    if (!selected || transitioningRef.current) return;
    const surface = surfaceRefs.current.get(selected.id);
    if (!surface) return;
    flipStateRef.current = Flip.getState(surface);
    const next = { ...selected, expanded: false };
    selectionRef.current = next;
    transitioningRef.current = true;
    setTransitioning(true);
    setSelection(next);
  }, []);

  useLayoutEffect(() => {
    if (!selection) {
      if (frozenRef.current) {
        if (scrollerRef.current)
          scrollerRef.current.scrollTop = savedScrollRef.current;
        orbitControlRef.current.resume();
        frozenRef.current = false;
        scrollerRef.current?.style.removeProperty("--focus-offset");
        const target = returnFocusRef.current;
        if (target?.isConnected && !target.closest("[inert]"))
          target.focus({ preventScroll: true });
        else scrollerRef.current?.focus({ preventScroll: true });
      }
      return;
    }
    const state = flipStateRef.current;
    if (!state) return;
    flipStateRef.current = null;
    flipContextRef.current?.revert();
    const surface = surfaceRefs.current.get(selection.id);
    // Reset the panel's single scroll container before restoring orbital sizing.
    if (!selection.expanded) {
      surface
        ?.querySelectorAll<HTMLElement>("div, article")
        .forEach((element) => {
          element.scrollTop = 0;
        });
    }
    flipContextRef.current = gsap.context(() => {
      Flip.from(state, {
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 0.65,
        ease: "power3.inOut",
        scale: true,
        onComplete: () => {
          transitioningRef.current = false;
          setTransitioning(false);
          if (selection.expanded) {
            // Wait for React to remove inert before moving keyboard focus.
            scheduleFocus(selection.id, selection.view);
          } else {
            selectionRef.current = null;
            setSelection(null);
          }
        },
      });
    }, sceneRef);
  }, [selection, scheduleFocus]);

  useEffect(() => {
    if (!selection) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing)
        return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog], [role=menu]",
        )
      )
        return;
      if (!sceneRef.current?.contains(target)) return;
      event.preventDefault();
      closePost();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selection, closePost]);

  useEffect(
    () => () => {
      cancelAnimationFrame(focusFrameRef.current);
      flipContextRef.current?.revert();
    },
    [],
  );

  useLayoutEffect(() => {
    const root = scrollerRef.current?.closest<HTMLElement>(
      "[data-universe-scene]",
    );
    if (!root) return;
    root.dataset.universeReady = String(!loading);
    return register("/", {
      root,
      pause: () => {
        savedScrollRef.current = scrollerRef.current?.scrollTop ?? 0;
        frozenRef.current = true;
        orbitControlRef.current.pause();
      },
      resume: () => {
        if (!selectionRef.current) {
          frozenRef.current = false;
          orbitControlRef.current.resume();
        }
      },
    });
  }, [register, loading, orbitKey]);

  function handleDeleted(id: number) {
    if (selectionRef.current?.id === id) {
      flipContextRef.current?.revert();
      flipStateRef.current = null;
      selectionRef.current = null;
      transitioningRef.current = false;
      setTransitioning(false);
      setSelection(null);
    }
    const removedIndex = posts.findIndex((post) => post.id === id);
    const activeIndex = Math.round(positionRef.current);
    if (removedIndex >= 0 && removedIndex < activeIndex) {
      positionRef.current = Math.max(0, positionRef.current - 1);
    } else if (removedIndex === activeIndex) {
      positionRef.current = activeIndex;
    }
    setPosts((current) => current.filter((post) => post.id !== id));
  }

  return (
    <div
      ref={scrollerRef}
      className={styles.scroller}
      data-focused={selection !== null}
      onScroll={(event) => {
        if (
          event.target === event.currentTarget &&
          frozenRef.current &&
          event.currentTarget.scrollTop !== savedScrollRef.current
        ) {
          event.currentTarget.scrollTop = savedScrollRef.current;
        }
      }}
      tabIndex={0}
      role="region"
      aria-label="Orbital post feed"
      aria-busy={loading}
    >
      <div ref={trackRef} className={styles.track}>
        <div ref={sceneRef} className={styles.scene}>
          <div className={styles.earthLayer}>
            <div
              ref={earthRef}
              className={earthStyles.stage}
              data-universe-earth
              aria-hidden="true"
            />
          </div>

          {loading && (
            <p data-universe-ui className={styles.status} role="status">
              Loading posts…
            </p>
          )}
          {error && (
            <div data-universe-ui className={styles.status} role="alert">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError("");
                  setRequest((current) => current + 1);
                }}
              >
                Try again
              </button>
            </div>
          )}
          {!loading && !error && posts.length === 0 && (
            <p data-universe-ui className={styles.status}>
              No posts yet. Share the first one with your world.
            </p>
          )}

          <div className={styles.focusWash} aria-hidden="true" />

          {posts.map((post) => (
            <OrbitalPost
              key={post.id}
              post={post}
              onDeleted={handleDeleted}
              onUpdated={(updated) => {
                setPosts((current) =>
                  current.map((item) =>
                    item.id === updated.id ? updated : item,
                  ),
                );
                if (
                  selectionRef.current?.id === updated.id &&
                  selectionRef.current.expanded
                ) {
                  openPost(updated.id, "post");
                }
              }}
              selected={selection?.id === post.id}
              expanded={selection?.id === post.id && selection.expanded}
              inactive={
                selection !== null &&
                (selection.id !== post.id || transitioning)
              }
              view={selection?.id === post.id ? selection.view : "post"}
              onOpen={(view) => openPost(post.id, view)}
              onClose={closePost}
              surfaceRef={(element) => {
                if (element) {
                  surfaceRefs.current.set(post.id, element);
                  element.dataset.universePost = "";
                } else surfaceRefs.current.delete(post.id);
              }}
              ref={(element) => {
                if (element) postRefs.current.set(post.id, element);
                else postRefs.current.delete(post.id);
              }}
            />
          ))}

          {posts.length > 0 && (
            <nav
              className={styles.controls}
              data-universe-ui
              aria-label="Browse orbital posts"
              inert={selection !== null}
            >
              <button
                ref={previousRef}
                type="button"
                aria-label="Previous post"
                onClick={() => navigateRef.current(-1)}
              >
                ↑
              </button>
              <div>
                <span ref={counterRef}>1 / {posts.length}</span>
                <p>
                  {posts.length > 1
                    ? "Scroll to explore"
                    : "You’re all caught up"}
                </p>
              </div>
              <button
                ref={nextRef}
                type="button"
                aria-label="Next post"
                onClick={() => navigateRef.current(1)}
              >
                ↓
              </button>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
