import { ViewTransition } from "react";
import styles from "./PageTransition.module.css";

/**
 * Animates only the route-owned content. Keep this inside persistent layouts so
 * navigation, providers, and WebGL backgrounds are never part of the snapshot.
 */
export default function PageTransition({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <ViewTransition
      default="none"
      enter="route-page-enter"
      exit="route-page-exit"
    >
      <div className={[styles.page, className].filter(Boolean).join(" ")}>{children}</div>
    </ViewTransition>
  );
}
