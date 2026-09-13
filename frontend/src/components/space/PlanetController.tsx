"use client";

import {
  Component,
  Suspense,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group } from "three";
import PlanetModel from "./PlanetModel";
import { DEFAULT_MODEL_ID, findSpaceModel, type SpaceModel } from "./modelsRegistry";
import { usePlanetPreference } from "@/features/planet-preference/context/PlanetPreferenceProvider";

interface PlanetControllerProps {
  className?: string;
  autoRotate?: boolean;
}

const ROTATE_SPEED = 0.12; // radians/sec — subtle, not a showcase spin
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function AutoRotateGroup({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const groupRef = useRef<Group>(null);
  useFrame((_, delta) => {
    if (!enabled || !groupRef.current) return;
    groupRef.current.rotation.y += delta * ROTATE_SPEED;
  });
  return <group ref={groupRef}>{children}</group>;
}

function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);
}

function resolveModel(planetId: string): SpaceModel {
  return findSpaceModel(planetId) ?? findSpaceModel(DEFAULT_MODEL_ID)!;
}

interface BoundaryProps {
  onError: () => void;
  children: ReactNode;
}
interface BoundaryState {
  hasError: boolean;
}

// A GLB fetch/parse failure surfaces as a thrown error during render (through
// Suspense), which only a class-based error boundary can catch. Keyed by the
// caller on modelConfig.id, so a fresh selection always gets a clean instance.
class PlanetLoadBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  componentDidCatch(error: unknown) {
    console.error("PlanetController: failed to load the planet model.", error);
    this.props.onError();
    this.setState({ hasError: true });
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

function PlanetScene({
  requestedModel,
  earthModel,
  shouldRotate,
}: {
  requestedModel: SpaceModel;
  earthModel: SpaceModel;
  shouldRotate: boolean;
}) {
  // Keyed on the requested planet by the parent, so this "fell back to
  // Earth" flag always starts fresh for a newly chosen planet without
  // needing an effect to reset it.
  const [fellBack, setFellBack] = useState(false);
  const modelConfig = fellBack ? earthModel : requestedModel;

  return (
    <PlanetLoadBoundary
      key={modelConfig.id}
      onError={() => {
        if (modelConfig.id !== earthModel.id) setFellBack(true);
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45, near: 0.01, far: 100 }}
        dpr={[1, 2]}
        frameloop={shouldRotate ? "always" : "demand"}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 2, 4]} intensity={1.5} />
        <Suspense fallback={null}>
          <AutoRotateGroup enabled={shouldRotate}>
            <PlanetModel modelConfig={modelConfig} />
          </AutoRotateGroup>
        </Suspense>
      </Canvas>
    </PlanetLoadBoundary>
  );
}

export default function PlanetController({ className, autoRotate = false }: PlanetControllerProps) {
  const { activePlanet, isReady } = usePlanetPreference();
  const reducedMotion = usePrefersReducedMotion();
  const shouldRotate = autoRotate && !reducedMotion;

  const requestedModel = useMemo(() => resolveModel(activePlanet), [activePlanet]);
  const earthModel = useMemo(() => resolveModel(DEFAULT_MODEL_ID), []);

  if (!isReady) return null;

  return (
    <div className={className}>
      <PlanetScene
        key={activePlanet}
        requestedModel={requestedModel}
        earthModel={earthModel}
        shouldRotate={shouldRotate}
      />
    </div>
  );
}
