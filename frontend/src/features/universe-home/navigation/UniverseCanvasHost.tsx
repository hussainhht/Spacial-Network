"use client";

import dynamic from "next/dynamic";
import { Component, memo, type ReactNode } from "react";
import type { UniverseCanvasProps } from "../contracts";

// Client-only. The scene measures the R3F viewport and creates a WebGL context,
// and the persistent host it is portalled into is a DOM node built after
// hydration, so there is nothing useful to prerender.
const UniverseCanvas = dynamic(() => import("../scene/UniverseCanvas"), {
  ssr: false,
});

/** The scene has its own boundary around the Canvas, but this payload is
 * portalled from the provider that wraps the entire shell. A failed chunk load
 * or a throw above that inner boundary would otherwise unmount the sidebar,
 * navbar and every destination link with it. */
class CanvasPayloadBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Universe canvas payload failed", error);
  }

  render() {
    // DOM navigation lives outside this payload and stays usable.
    return this.state.failed ? null : this.props.children;
  }
}

// `ref` is forwarded explicitly rather than relying on the spread, matching the
// existing HomeEarth payload's proven pattern. The stage element only exists
// once the lazy chunk resolves, so the provider uses a callback ref.
function UniverseCanvasHost({ ref, ...props }: UniverseCanvasProps) {
  return (
    <CanvasPayloadBoundary>
      <UniverseCanvas ref={ref} {...props} />
    </CanvasPayloadBoundary>
  );
}

// Provider state changes (active planet, recorded selection) must not re-render
// the scene payload; only its own props may.
export default memo(UniverseCanvasHost);
