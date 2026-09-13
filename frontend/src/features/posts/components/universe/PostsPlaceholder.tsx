import styles from "./PostsOverlay.module.css";

/**
 * A static card at the size a real post will be.
 *
 * It exists so the Posts layout can be judged against the planet before any
 * feed is connected: it is not data, it is not interactive, and it says so.
 */
export default function PostsPlaceholder() {
  return (
    <article className={styles.card} aria-label="Example post">
      <header className={styles.cardHeader}>
        <span className={styles.avatar} aria-hidden="true">
          S
        </span>
        <div className={styles.byline}>
          <p className={styles.author}>Someone you follow</p>
          <p className={styles.meta}>Just now</p>
        </div>
        <span className={styles.chip}>Preview</span>
      </header>
      <p className={styles.cardBody}>
        Posts from the people you follow will appear here. Each one stays a card
        you can read comfortably, react to and reply to, with Earth turning
        beside it.
      </p>
      <footer className={styles.actions} aria-hidden="true">
        <span>Like</span>
        <span>Comment</span>
        <span>Share</span>
      </footer>
    </article>
  );
}
