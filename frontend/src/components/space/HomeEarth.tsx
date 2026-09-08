"use client";

import dynamic from "next/dynamic";
import { memo, Component, type ReactNode, type Ref } from "react";
import type { EarthHandle } from "@/features/universe-transition/types";
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

function HomeEarth({
  ref,
  onTransitionReady,
  transitionActive,
  renderActive,
}: {
  ref?: Ref<HTMLDivElement>;
  transitionActive?: boolean;
  renderActive?: boolean;
  onTransitionReady?: (handle: EarthHandle | null) => void;
}) {
  return (
    <div ref={ref} className={styles.stage} aria-label="3D Earth">
      <EarthErrorBoundary>
        <Earth3D
          onTransitionReady={onTransitionReady}
          transitionActive={transitionActive}
          renderActive={renderActive}
          autoRotate
          rotationSpeed={0.04}
          interactive={false}
          background={null}
          boundsMargin={1.02}
          ariaLabel="Earth rotating in space"
        />
      </EarthErrorBoundary>
    </div>
  );
}

// Keep Canvas configuration stable when the route coordinator changes state.
// Route content updates need not rebuild the scene.
export default memo(HomeEarth);
