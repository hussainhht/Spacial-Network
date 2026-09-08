"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import styles from "./HomeEarth.module.css";

const Earth3D = dynamic(() => import("./Earth3D"), {
  ssr: false,
  loading: () => (
    <div className={styles.loadingPlaceholder} aria-hidden="true" />
  ),
});

class EarthErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

export default function HomeEarth() {
  return (
    <div className={styles.stage} aria-label="3D Earth">
      <EarthErrorBoundary>
        <Earth3D
          autoRotate
          rotationSpeed={0.04}
          interactive={false}
          background={null}
          ariaLabel="Earth rotating in space"
        />
      </EarthErrorBoundary>
    </div>
  );
}
