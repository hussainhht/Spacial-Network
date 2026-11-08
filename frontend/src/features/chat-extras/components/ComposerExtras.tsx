"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmojiStyle, SuggestionMode, Theme, type EmojiClickData } from "emoji-picker-react";
import GifPicker from "./GifPicker";
import styles from "./ComposerExtras.module.css";

// The emoji dataset is large; only load it when the picker is first opened.
const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
  loading: () => <p className={styles.gifStatus} role="status">Loading emojis…</p>,
});

type Panel = "emoji" | "gif" | null;
interface Position { left: number; bottom: number; width: number; maxHeight: number }

interface ComposerExtrasProps {
  onEmoji: (emoji: string) => void;
  onGif: (url: string) => void;
  disabled?: boolean;
}

export default function ComposerExtras({ onEmoji, onGif, disabled = false }: ComposerExtrasProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const emojiBtn = useRef<HTMLButtonElement>(null);
  const gifBtn = useRef<HTMLButtonElement>(null);
  const popId = useId();

  const close = useCallback((restoreFocus = false) => {
    setPanel((current) => {
      if (current && restoreFocus) (current === "emoji" ? emojiBtn : gifBtn).current?.focus();
      return null;
    });
  }, []);

  const place = useCallback(() => {
    const anchor = wrapRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const margin = 8;
    const width = Math.min(panel === "gif" ? 360 : 350, window.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - width - margin));
    const bottom = window.innerHeight - anchor.top + margin;
    setPosition({ left, bottom, width, maxHeight: Math.max(220, anchor.top - margin * 2) });
  }, [panel]);

  useLayoutEffect(() => {
    if (!panel) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [panel, place]);

  useEffect(() => {
    if (!panel) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (popRef.current?.contains(target) || wrapRef.current?.contains(target)) return;
      close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [panel, close]);

  const toggle = (next: Exclude<Panel, null>) => setPanel((current) => (current === next ? null : next));
  const height = position ? Math.min(400, position.maxHeight) : 400;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={emojiBtn}
        type="button"
        className={`${styles.trigger} ${panel === "emoji" ? styles.active : ""}`}
        disabled={disabled}
        aria-label="Add emoji"
        title="Add emoji"
        aria-haspopup="dialog"
        aria-expanded={panel === "emoji"}
        aria-controls={panel === "emoji" ? popId : undefined}
        onClick={() => toggle("emoji")}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M8 14.5s1.5 2 4 2 4-2 4-2" />
          <path d="M9 9.5h.01M15 9.5h.01" />
        </svg>
      </button>
      <button
        ref={gifBtn}
        type="button"
        className={`${styles.trigger} ${panel === "gif" ? styles.active : ""}`}
        disabled={disabled}
        aria-label="Send a GIF"
        title="Send a GIF"
        aria-haspopup="dialog"
        aria-expanded={panel === "gif"}
        aria-controls={panel === "gif" ? popId : undefined}
        onClick={() => toggle("gif")}
      >
        GIF
      </button>

      {panel &&
        position &&
        createPortal(
          <div
            ref={popRef}
            id={popId}
            role="dialog"
            aria-label={panel === "emoji" ? "Emoji picker" : "GIF picker"}
            className={styles.popover}
            style={{ left: position.left, bottom: position.bottom, width: position.width, maxHeight: position.maxHeight }}
          >
            {panel === "emoji" ? (
              <EmojiPicker
                theme={Theme.DARK}
                emojiStyle={EmojiStyle.NATIVE}
                suggestedEmojisMode={SuggestionMode.RECENT}
                width="100%"
                height={height}
                lazyLoadEmojis
                previewConfig={{ showPreview: false }}
                searchPlaceholder="Search emojis"
                onEmojiClick={(data: EmojiClickData) => onEmoji(data.emoji)}
              />
            ) : (
              <GifPicker
                onPick={(url) => {
                  onGif(url);
                  close();
                }}
              />
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
