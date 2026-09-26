import styles from "./PageTransition.module.css";

/**
 * Animates route-owned content on mount with a smooth GPU-accelerated fade
 * without raster snapshots or height-interpolation distortion.
 */
export default function PageTransition({
  children,
  className,
}: Readonly<{ children: React.ReactNode; className?: string }>) {
  return (
    <div className={[styles.page, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
