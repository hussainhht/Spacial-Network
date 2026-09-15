import type { PostMedia } from "@/features/posts/types/post";
import { getBackendBaseUrl } from "@/lib/api";
import styles from "./PostMediaGrid.module.css";

interface PostMediaGridProps {
  media: PostMedia[];
}

function mediaUrl(url: string) {
  if (/^(blob:|data:|https?:\/\/)/i.test(url)) return url;
  return `${getBackendBaseUrl()}${url.startsWith("/") ? url : `/${url}`}`;
}

export default function PostMediaGrid({ media }: PostMediaGridProps) {
  const ordered = [...media].sort((a, b) => a.order - b.order);
  if (ordered.length === 0) return null;

  return (
    <div
      className={`${styles.grid} ${styles[`count${Math.min(ordered.length, 4)}`]}`}
      aria-label={`${ordered.length} post media ${ordered.length === 1 ? "item" : "items"}`}
    >
      {ordered.map((item, index) => (
        // Local blob URLs and backend uploads cannot use Next image optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${item.id}-${item.url}`}
          className={styles.item}
          src={mediaUrl(item.url)}
          alt={`Post attachment ${index + 1} of ${ordered.length}`}
        />
      ))}
    </div>
  );
}
