"use client";

import { memo, useId, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import styles from "./ExpandablePostText.module.css";

const MAX_LINES = 4;

export default memo(function ExpandablePostText({
  content,
  className,
}: {
  content: string;
  className: string;
}) {
  const id = useId();
  const textRef = useRef<HTMLParagraphElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text) return;
    let active = true;
    let previousWidth = -1;
    const measure = () => {
      if (!active) return;
      const lineHeight = Number.parseFloat(getComputedStyle(text).lineHeight);
      // scrollHeight includes the hidden lines, even while max-height clips them.
      setOverflowing(text.scrollHeight > MAX_LINES * lineHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      // Expanding changes height, but does not require another measurement.
      if (width === previousWidth) return;
      previousWidth = width;
      measure();
    });
    observer.observe(text);
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      active = false;
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [content]);

  return (
    <div className={styles.wrapper}>
      <p
        ref={textRef}
        id={id}
        className={`${className} ${!expanded ? styles.collapsed : ""}`}
        dir="auto"
      >
        {content}
      </p>
      {overflowing && (
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={expanded}
          aria-controls={id}
          onClick={(event) => {
            const button = event.currentTarget;
            flushSync(() => setExpanded(!expanded));
            // A very tall post can move the focused control above the scroll
            // pane on collapse. Keep it reachable without animated scrolling.
            const pane = button.closest("#page-content");
            const top = pane?.getBoundingClientRect().top ?? 0;
            if (expanded && button.getBoundingClientRect().top < top) {
              button.scrollIntoView({ block: "nearest", behavior: "instant" });
            }
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
});
