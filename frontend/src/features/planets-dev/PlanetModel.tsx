"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import DevPlanetModel from "@/components/space/DevPlanetModel";
import type { PlanetConfig } from "./planetConfig";

export default function PlanetModel({ planet }: { planet: PlanetConfig }) {
  const spin = useRef<Group>(null);
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += Math.min(delta, 0.1) * planet.rotationSpeed;
  });
  return (
    <group name={`PlanetRoot-${planet.id}`} position={planet.position} scale={planet.scale}>
      <group ref={spin} name={`PlanetSpin-${planet.id}`}>
        <DevPlanetModel modelConfig={planet.model} />
      </group>
    </group>
  );
}
