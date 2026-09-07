"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import styles from "./page.module.css";

const Earth3D = dynamic(() => import("@/components/space/Earth3D"), {
  ssr: false,
  loading: () => <p className={styles.message} role="status">Loading 3D model...</p>,
});

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className={styles.message} role="alert">
          <p>Unable to load the 3D preview.</p>
          <p>Check /models/earth-final.glb and WebGL support, then reload to try again.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload preview</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ModelPreview() {
  return (
    <section className={styles.preview} aria-label="Earth model preview">
      <PreviewBoundary><Earth3D /></PreviewBoundary>
    </section>
  );
}
