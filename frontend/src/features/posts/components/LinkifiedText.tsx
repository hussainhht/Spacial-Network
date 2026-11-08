import { splitLinks } from "@/features/posts/lib/linkify";
import styles from "./LinkifiedText.module.css";

/** Renders text with http(s) URLs as safe external links. */
export default function LinkifiedText({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((segment, index) =>
        segment.type === "link" ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            {segment.value}
          </a>
        ) : (
          segment.value
        ),
      )}
    </>
  );
}
