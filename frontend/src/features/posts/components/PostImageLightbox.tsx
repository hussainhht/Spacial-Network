"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import styles from "./PostImageLightbox.module.css";

export interface LightboxImage {
  src: string;
  alt: string;
}

interface PostImageLightboxProps {
  images: LightboxImage[];
  startIndex: number;
  onClose: () => void;
}

const SWIPE_THRESHOLD = 48;
const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export default function PostImageLightbox({ images, startIndex, onClose }: PostImageLightboxProps) {
  const count = images.length;
  const [index, setIndex] = useState(startIndex);
  const [failed, setFailed] = useState<Record<number, number>>({});
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const go = useCallback(
    (delta: number) => {
      if (count > 1) setIndex((current) => (current + delta + count) % count);
    },
    [count],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
      } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && count > 1) {
        event.preventDefault();
        event.stopPropagation();
        go(event.key === "ArrowLeft" ? -1 : 1);
      } else if (event.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (!dialogRef.current.contains(active)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [count, go]);

  // Preload the neighbouring images; the references are dropped on cleanup.
  useEffect(() => {
    if (count < 2) return;
    const preloaders = [-1, 1].map((delta) => {
      const img = new Image();
      img.src = images[(index + delta + count) % count].src;
      return img;
    });
    return () => {
      preloaders.forEach((img) => {
        img.src = "";
      });
    };
  }, [images, index, count]);

  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    touchStart.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function handleTouchEnd(event: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx > 0 ? -1 : 1);
  }

  const current = images[index];
  const attempt = failed[index];
  const hasFailed = attempt !== undefined && !loaded[index];

  return createPortal(
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={`Image viewer, ${index + 1} of ${count}`}
      ref={dialogRef}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button ref={closeRef} type="button" className={`${styles.control} ${styles.close}`} onClick={onClose} aria-label="Close image viewer">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {count > 1 && (
        <div className={styles.counter} aria-live="polite">
          {index + 1} / {count}
        </div>
      )}

      <div
        className={styles.stage}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          touchStart.current = null;
        }}
      >
        {hasFailed ? (
          <div className={styles.error} role="alert">
            <p>This image could not be loaded.</p>
            <button
              type="button"
              className={styles.retry}
              onClick={() =>
                setFailed((state) => {
                  const next = { ...state };
                  delete next[index];
                  return next;
                })
              }
            >
              Retry
            </button>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${index}-${attempt ?? 0}`}
            className={`${styles.image} ${loaded[index] ? styles.loaded : ""}`}
            src={current.src}
            alt={current.alt}
            draggable={false}
            decoding="async"
            onLoad={() => setLoaded((state) => ({ ...state, [index]: true }))}
            onError={() => setFailed((state) => ({ ...state, [index]: (state[index] ?? 0) + 1 }))}
          />
        )}
      </div>

      {count > 1 && (
        <>
          <button type="button" className={`${styles.control} ${styles.prev}`} onClick={() => go(-1)} aria-label="Previous image">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button type="button" className={`${styles.control} ${styles.next}`} onClick={() => go(1)} aria-label="Next image">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
