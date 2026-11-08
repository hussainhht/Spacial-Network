"use client";

import { useEffect, useMemo, useState } from "react";
import { gifThumbUrl, gifUrlFromId, searchGifs } from "../lib/gif";
import styles from "./ComposerExtras.module.css";

function GifThumb({ id, label, onPick }: { id: string; label: string; onPick: (url: string) => void }) {
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const full = gifUrlFromId(id);
  if (state === "failed") return null;
  return (
    <button
      type="button"
      className={`${styles.gifCell} ${state === "loading" ? styles.gifLoading : ""}`}
      aria-label={`Send ${label} GIF`}
      onClick={() => onPick(full)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={gifThumbUrl(full)}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        draggable={false}
        onLoad={() => setState("loaded")}
        onError={() => setState("failed")}
      />
    </button>
  );
}

export default function GifPicker({ onPick }: { onPick: (url: string) => void }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo(() => searchGifs(debounced), [debounced]);
  const searching = query !== debounced;

  return (
    <div className={styles.gifPicker}>
      <input
        type="search"
        autoFocus
        className={styles.gifSearch}
        placeholder="Search GIFs"
        aria-label="Search GIFs"
        value={query}
        maxLength={60}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className={styles.gifScroll} aria-busy={searching}>
        <p className={styles.gifHeading}>{debounced.trim() ? "Results" : "Trending"}</p>
        {searching ? (
          <p className={styles.gifStatus} role="status">Searching…</p>
        ) : results.length === 0 ? (
          <p className={styles.gifStatus} role="status">No GIFs found for &ldquo;{debounced.trim()}&rdquo;.</p>
        ) : (
          <div className={styles.gifGrid}>
            {results.map((gif) => (
              <GifThumb key={gif.id} id={gif.id} label={gif.tags} onPick={onPick} />
            ))}
          </div>
        )}
      </div>
      <p className={styles.gifAttribution}>GIFs via GIPHY</p>
    </div>
  );
}
