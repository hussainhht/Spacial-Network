import type { PostMedia } from "@/features/posts/types/post";
import { getBackendBaseUrl } from "@/lib/api";
import styles from "./PostMediaGrid.module.css";

interface PostMediaGridProps {
  media: PostMedia[];
  preview?: boolean;
}

function mediaUrl(url: string) {
  if (/^(blob:|data:|https?:\/\/)/i.test(url)) return url;
  return `${getBackendBaseUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}

export default function PostMediaGrid({ media, preview = false }: PostMediaGridProps) {
  const ordered = [...media].sort((a, b) => a.order - b.order);
  if (ordered.length === 0) return null;
  const visible = preview ? ordered.slice(0, 4) : ordered;
  const hiddenCount = ordered.length - visible.length;

  return (
    <div
      className={`${styles.grid} ${styles[`count${Math.min(visible.length, 4)}`]} ${preview ? styles.preview : styles.detail}`}
      aria-label={`${ordered.length} post media ${ordered.length === 1 ? "item" : "items"}`}
    >
      {visible.map((item, index) => (
        <div className={styles.cell} key={`${item.id}-${item.url}`}>
          {/* Local blob URLs and backend uploads cannot use Next image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.item} src={mediaUrl(item.url)} alt={`Post attachment ${index + 1} of ${ordered.length}`} loading={preview ? "lazy" : "eager"} />
          {hiddenCount > 0 && index === visible.length - 1 && (
            <span className={styles.more} aria-label={`${hiddenCount} more attachments`}>+{hiddenCount}</span>
          )}
        </div>
      ))}
    </div>
  );
}
