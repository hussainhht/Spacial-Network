"use client";

import { useState } from "react";
import PostImageLightbox from "@/features/posts/components/PostImageLightbox";
import styles from "./GifMessage.module.css";

/** Renders an already-validated trusted GIF URL inside a chat bubble. */
export default function GifMessage({ url }: { url: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [open, setOpen] = useState(false);

  if (status === "failed") {
    return <div className={styles.failed}>GIF unavailable</div>;
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.frame} ${status === "loading" ? styles.loading : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Open GIF preview"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.image}
          src={url}
          alt="GIF"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
        />
      </button>
      {open && <PostImageLightbox images={[{ src: url, alt: "GIF" }]} startIndex={0} onClose={() => setOpen(false)} />}
    </>
  );
}
