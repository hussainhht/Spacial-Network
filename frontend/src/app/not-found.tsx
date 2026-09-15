import Link from "next/link";
import AppIcon from "@/components/layout/AppIcon";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <section className={styles.content} aria-labelledby="not-found-title">
        <span className={styles.code} aria-hidden="true">404</span>
        <div className={styles.icon}><AppIcon name="orbit" width={30} height={30} /></div>
        <p className={styles.eyebrow}>Page not found</p>
        <h1 id="not-found-title">This route is outside the map.</h1>
        <p className={styles.description}>
          The page may have moved, been removed, or the address may be incorrect.
        </p>
        <div className={styles.actions}>
          <Link href="/" className={styles.primaryAction}>
            <AppIcon name="home" width={17} height={17} /> Go home
          </Link>
        </div>
      </section>
    </main>
  );
}
