"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { orbitPosition } from "../config/composition";
import {
  MAX_FRAME_DELTA,
  orbitSpeed,
  type PlanetConfig,
} from "../config/planets";
import EarthSystem from "./EarthSystem";
import PlanetModel, { type AssetErrorReporter } from "./PlanetModel";

const DEGREES = Math.PI / 180;

/**
 * One planet on its ring.
 *
 * Three transforms, one writer each: the anchor carries the body round the Sun,
 * a fixed tilt sets its axis, and the spin root turns beneath that tilt. Keeping
 * the tilt above the spin is what makes Uranus roll along its orbit rather than
 * wobble, and what will let a future camera move take the anchor without having
 * to stop the rotation.
 *
 * The orbit angle lives in a ref rather than in state: it is written every frame
 * and read by nothing else, and a render per frame is the one thing this scene
 * cannot afford.
 */
export default function Planet({
  planet,
  spread,
  animate,
  onAssetError,
}: {
  planet: PlanetConfig;
  spread: number;
  animate: boolean;
  onAssetError: AssetErrorReporter;
}) {
  const anchor = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const angle = useRef(planet.orbitAngle * DEGREES);
  const radius = planet.orbitRadius * spread;
  const speed = orbitSpeed(planet.orbitRadius);

  useFrame((_, delta) => {
    if (!animate) return;
    const step = Math.min(delta, MAX_FRAME_DELTA);
    angle.current += speed * step;
    if (anchor.current) {
      anchor.current.position.set(
        Math.cos(angle.current) * radius,
        0,
        -Math.sin(angle.current) * radius,
      );
    }
    if (spin.current) spin.current.rotation.y += step * planet.spinSpeed;
  });

  return (
    <group
      ref={anchor}
      name={`${planet.id}-Orbit`}
      // The resting placement, so a scene that never animates — a reduced-motion
      // preference — is still the composition that was authored.
      position={orbitPosition(planet, spread, 0)}
    >
      {planet.id === "earth" ? (
        <EarthSystem
          planet={planet}
          radius={planet.radius}
          animate={animate}
          onAssetError={onAssetError}
        />
      ) : (
        <group
          name={`${planet.id}-Axis`}
          rotation-y={planet.tiltDirection * DEGREES}
        >
          <group rotation-z={planet.axialTilt}>
            <group ref={spin} name={`${planet.id}-Spin`}>
              <group scale={planet.radius}>
                <PlanetModel model={planet.model} onAssetError={onAssetError} />
              </group>
            </group>
          </group>
        </group>
      )}
    </group>
  );
}
