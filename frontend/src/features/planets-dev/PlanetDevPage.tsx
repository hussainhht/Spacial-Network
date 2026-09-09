"use client";

import dynamic from "next/dynamic";
import styles from "./PlanetDevPage.module.css";

const PlanetStage = dynamic(() => import("./PlanetStage"), {
  ssr: false,
  loading: () => <p role="status">Loading planet viewer…</p>,
});

export default function PlanetDevPage() {
  return (
    <main className={styles.lab}>
      <header>
        <h1>PLANET LAB</h1>
        <p>Four-planet development preview</p>
      </header>
      <div className={styles.scrollArea} tabIndex={0} role="region" aria-label="Planet preview. Scroll horizontally on smaller screens to see all four planets.">
        <div className={styles.stage}><PlanetStage /></div>
      </div>
    </main>
  );
}
