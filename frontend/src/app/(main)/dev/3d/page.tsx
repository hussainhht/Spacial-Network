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
        <h1>3D Models</h1>
        <p>A development workspace for previewing and testing 3D models.</p>
      </header>
      <ModelPreview />
    </main>
  );
}
