"use client";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import styles from "./AboutDemoModal.module.css";

export const DEMO_SOURCE_URL = "https://github.com/hussainhht/Spacial-Network";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  onClose: () => void;
  /** Receives focus on close when the opener no longer exists (e.g. a closed menu). */
  fallbackFocus?: React.RefObject<HTMLElement | null>;
}

/** Mounted only while open, so it never renders during SSR or hydration. */
export default function AboutDemoModal({ onClose, fallbackFocus }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const fallback = fallbackFocus?.current;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("button")?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const usable = opener?.isConnected && opener !== document.body;
      const target = usable ? opener : fallback;
      target?.focus();
    };
  }, [fallbackFocus]);

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className={styles.head}>
          <h2 id={titleId}>About this demo</h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close about demo"
          >
            ×
          </button>
        </div>
        <p>
          This is an interactive demonstration of Spatial Network, a social
          network built around communities, posts, events and chat.
        </p>
        <ul>
          <li>
            Every profile, post, conversation and community is fictional sample
            data.
          </li>
          <li>
            Your actions are simulated in this browser only and never leave it.
          </li>
          <li>
            The full application runs on a Go backend with SQLite and realtime
            WebSockets. This demo does not connect to it.
          </li>
        </ul>
        <a href={DEMO_SOURCE_URL} target="_blank" rel="noreferrer">
          View full-stack source ↗
        </a>
      </div>
    </div>,
    document.body,
  );
}
