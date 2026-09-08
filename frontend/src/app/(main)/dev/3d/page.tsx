import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ModelPreview from "./ModelPreview";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "3D Model Lab",
  robots: { index: false, follow: false },
};

export default function ModelLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className={styles.lab}>
      <header>
        <p>A development workspace for previewing and testing 3D models.</p>
      </header>
      <ModelPreview />
      <p className={styles.hint}>Drag to rotate · Wheel or pinch to zoom · Panning disabled</p>
      <dl className={styles.info}>
        <div><dt>Model</dt><dd>earth-final.glb</dd></div>
        <div><dt>Format</dt><dd>GLB</dd></div>
        <div><dt>Status</dt><dd>Development Preview</dd></div>
      </dl>
      <p className={styles.hint}>Preview materials: recolored coastline map, procedural clouds, and a subtle atmosphere. Terrain colors and weather are illustrative.</p>
    </main>
  );
}
