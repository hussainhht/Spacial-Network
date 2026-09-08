import { memo } from "react";
import { STAR_FIELD, type StarPoint } from "./starData";
import styles from "./SpaceBackground.module.css";

function renderStarCircle(star: StarPoint) {
  return (
    <circle
      key={star.id}
      cx={star.cx}
      cy={star.cy}
      r={star.r}
      fill={star.color}
      opacity={star.opacity}
    />
  );
}

function renderBrightStar(star: StarPoint) {
  return (
    <g key={star.id}>
      {/* Soft halo */}
      <circle
        cx={star.cx}
        cy={star.cy}
        r={star.r * 2.8}
        fill={star.color}
        className={styles.starGlowHalo}
      />
      {/* Micro diffraction spikes on key focal stars */}
      {star.hasSpike && (
        <>
          <line
            x1={star.cx - 6}
            y1={star.cy}
            x2={star.cx + 6}
            y2={star.cy}
            className={styles.starburstLine}
          />
          <line
            x1={star.cx}
            y1={star.cy - 6}
            x2={star.cx}
            y2={star.cy + 6}
            className={styles.starburstLine}
          />
        </>
      )}
      {/* Star core */}
      <circle
        cx={star.cx}
        cy={star.cy}
        r={star.r}
        fill={star.color}
        opacity={star.opacity}
      />
    </g>
  );
}

function SpaceBackground() {
  const { distantStars, mediumStars, brightStars } = STAR_FIELD;

  // Group distant stars
  const distantStatic = distantStars.filter((s) => s.group === "static");
  const distantTwinkleA = distantStars.filter((s) => s.group === "twinkleA");
  const distantTwinkleB = distantStars.filter((s) => s.group === "twinkleB");
  const distantTwinkleC = distantStars.filter((s) => s.group === "twinkleC");

  // Group medium stars
  const mediumStatic = mediumStars.filter((s) => s.group === "static");
  const mediumTwinkleA = mediumStars.filter((s) => s.group === "twinkleA");
  const mediumTwinkleB = mediumStars.filter((s) => s.group === "twinkleB");
  const mediumTwinkleD = mediumStars.filter((s) => s.group === "twinkleD");

  // Group bright stars
  const brightPulse = brightStars.filter((s) => s.group === "pulse");
  const brightStatic = brightStars.filter((s) => s.group === "static");

  return (
    <div
      data-universe-background
      className={styles.spaceContainer}
      aria-hidden="true"
    >
      {/* Subtle cosmic haze & ambient dust clouds */}
      <div className={styles.cosmicHazeLayer}>
        <div className={styles.dustCloud1} />
        <div className={styles.dustCloud2} />
        <div className={styles.dustCloud3} />
        <div className={styles.dustCloud4} />
      </div>

      {/* Layer 1: Extremely distant stars (drift 85s) */}
      <div className={styles.layerDistant}>
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
          className={styles.starSvg}
        >
          <g>{distantStatic.map(renderStarCircle)}</g>
          <g className={styles.twinkleFarA}>
            {distantTwinkleA.map(renderStarCircle)}
          </g>
          <g className={styles.twinkleFarB}>
            {distantTwinkleB.map(renderStarCircle)}
          </g>
          <g className={styles.twinkleFarC}>
            {distantTwinkleC.map(renderStarCircle)}
          </g>
        </svg>
      </div>

      {/* Layer 2: Medium distant stars (drift 65s) */}
      <div className={styles.layerMedium}>
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
          className={styles.starSvg}
        >
          <g>{mediumStatic.map(renderStarCircle)}</g>
          <g className={styles.twinkleMidA}>
            {mediumTwinkleA.map(renderStarCircle)}
          </g>
          <g className={styles.twinkleMidB}>
            {mediumTwinkleB.map(renderStarCircle)}
          </g>
          <g className={styles.twinkleMidD}>
            {mediumTwinkleD.map(renderStarCircle)}
          </g>
        </svg>
      </div>

      {/* Layer 3: Bright focal stars (drift 52s) */}
      <div className={styles.layerBright}>
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid slice"
          className={styles.starSvg}
        >
          <g className={styles.pulseBright}>
            {brightPulse.map(renderBrightStar)}
          </g>
          <g className={styles.brightStatic}>
            {brightStatic.map(renderBrightStar)}
          </g>
        </svg>
      </div>

      {/* Subtle depth vignette */}
      <div className={styles.vignetteOverlay} />
    </div>
  );
}

export default memo(SpaceBackground);
