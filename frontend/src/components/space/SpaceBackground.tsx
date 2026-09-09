"use client";

import { memo, useId } from "react";
import { usePathname } from "next/navigation";
import { STAR_FIELD, batchStars } from "./starData";
import styles from "./SpaceBackground.module.css";

const distantPaths = batchStars(STAR_FIELD.distantStars);
const mediumPaths = batchStars(STAR_FIELD.mediumStars);

function StarPaths({ paths }: { paths: typeof distantPaths }) {
  return paths.map(({ id, d, color, opacity, group }) => (
    <path key={id} d={d} fill={color} opacity={opacity} className={styles[group]} />
  ));
}

function SpaceBackground() {
  const pathname = usePathname();
  const haloId = useId();

  return (
    <div
      data-universe-background
      data-scene={pathname === "/groups" ? "groups" : undefined}
      className={styles.spaceContainer}
      aria-hidden="true"
    >
      <div className={styles.cosmicHazeLayer} />
      <div className={styles.dustVeil} />
      <div className={styles.layerDistant}>
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" className={styles.starSvg}>
          <StarPaths paths={distantPaths} />
        </svg>
      </div>
      <div className={styles.layerMedium}>
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" className={styles.starSvg}>
          <StarPaths paths={mediumPaths} />
        </svg>
      </div>
      <div className={styles.layerBright}>
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" className={styles.starSvg}>
          <defs>
            <radialGradient id={haloId}>
              <stop offset="0" stopColor="#d4e5ff" stopOpacity="0.3" />
              <stop offset="0.25" stopColor="#b9d4fa" stopOpacity="0.1" />
              <stop offset="1" stopColor="#b9d4fa" stopOpacity="0" />
            </radialGradient>
          </defs>
          {STAR_FIELD.brightStars.map((star, index) => (
            <g key={star.id}>
              {index % 3 === 0 && <circle cx={star.cx} cy={star.cy} r={star.r * 6} fill={`url(#${haloId})`} />}
              <circle cx={star.cx} cy={star.cy} r={star.r} fill={star.color} opacity={star.opacity} />
            </g>
          ))}
        </svg>
      </div>
      <div className={styles.vignetteOverlay} />
    </div>
  );
}

export default memo(SpaceBackground);
