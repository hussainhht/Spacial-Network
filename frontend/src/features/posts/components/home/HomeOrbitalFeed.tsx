"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import HomeEarth from "@/components/space/HomeEarth";
import { listPosts } from "../../api/posts";
import type { Post } from "../../types/post";
import { ApiError } from "@/lib/api/errors";
import OrbitalPost from "./OrbitalPost";
import styles from "./HomeOrbitalFeed.module.css";

const FRONT_ANGLE = 2.45;
const ANGLE_STEP = 0.95;

export default function HomeOrbitalFeed() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [request, setRequest] = useState(0);
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
  const positionRef = useRef(0);

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
    if (!scroller || !track || !scene || !earth || !posts.length) return;

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();

    // matchMedia owns a scoped GSAP context, including its ScrollTrigger.
    media.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const cards = posts.flatMap((post, index) => {
          const element = postRefs.current.get(post.id);
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
        const lastIndex = posts.length - 1;
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
          positionRef.current = playhead.position;
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
            counterRef.current.textContent = `${active + 1} / ${posts.length}`;
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
        const observer = new ResizeObserver(() => {
          cancelAnimationFrame(resizeFrame);
          resizeFrame = requestAnimationFrame(() => {
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
  }, [posts]);

  function handleDeleted(id: number) {
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
      tabIndex={0}
      role="region"
      aria-label="Orbital post feed"
      aria-busy={loading}
    >
      <div ref={trackRef} className={styles.track}>
        <div ref={sceneRef} className={styles.scene}>
          <div className={styles.earthLayer}>
            <HomeEarth ref={earthRef} />
          </div>
          <header className={styles.heading}>
            <div>
              <p>Your orbit</p>
              <h1>Home</h1>
            </div>
            <Link href="/posts/new" className={styles.newPost}>
              New post
            </Link>
          </header>

          {loading && (
            <p className={styles.status} role="status">
              Loading posts…
            </p>
          )}
          {error && (
            <div className={styles.status} role="alert">
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
            <p className={styles.status}>
              No posts yet. Share the first one with your world.
            </p>
          )}

          {posts.map((post) => (
            <OrbitalPost
              key={post.id}
              post={post}
              onDeleted={handleDeleted}
              ref={(element) => {
                if (element) postRefs.current.set(post.id, element);
                else postRefs.current.delete(post.id);
              }}
            />
          ))}

          {posts.length > 0 && (
            <nav className={styles.controls} aria-label="Browse orbital posts">
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
