import {
  Quaternion,
  Vector3,
  type Object3D,
  type PerspectiveCamera,
} from "three";
import type { SolarFraming } from "../config/composition";
import { PLANETS, type PlanetId } from "../config/planets";
import {
  bodyCameraTier,
  UNIVERSE_DESTINATIONS,
  type BodyCameraTier,
  type UniverseDestinationId,
} from "./destinations";

/** Everything a camera is: where it is, what it looks at, and its lens. */
export type CameraPose = { position: Vector3; target: Vector3; fov: number };

export function createPose(): CameraPose {
  return { position: new Vector3(), target: new Vector3(), fov: 30 };
}

export function copyPose(source: CameraPose, into: CameraPose): CameraPose {
  into.position.copy(source.position);
  into.target.copy(source.target);
  into.fov = source.fov;
  return into;
}

/**
 * The one piece of state the transition timeline and the camera share.
 *
 * GSAP writes `progress` and nothing else; the camera controller reads the rig
 * inside `useFrame` and is the only thing that ever writes the camera. That
 * split is what lets a destination be a moving body: the timeline cannot tween
 * towards a fixed endpoint that Earth will have left by the time it arrives, so
 * it tweens a number, and the pose that number means is resolved every frame.
 */
export type CameraRig = {
  /** `snapshot` when a move was interrupted: the next one starts from wherever
   * the camera actually was, not from a destination it never reached. */
  from: UniverseDestinationId | "snapshot";
  to: UniverseDestinationId;
  /** 0 at `from`, 1 at `to`. Linear; the easing is applied per channel. */
  progress: number;
  /** The pose the camera was last given. */
  current: CameraPose;
  snapshot: CameraPose;
  /** Installed by the controller. A reduced-motion scene renders on demand, so
   * a timeline that moves the camera has to ask for the frames that show it. */
  invalidate: () => void;
};

export function createCameraRig(at: UniverseDestinationId): CameraRig {
  return {
    from: at,
    to: at,
    progress: 1,
    current: createPose(),
    snapshot: createPose(),
    invalidate: () => {},
  };
}

export type PoseContext = {
  framing: SolarFraming;
  /** Pane width / height. */
  aspect: number;
  /** The live scene nodes whose world position a body destination follows. */
  bodies: ReadonlyMap<PlanetId, Object3D>;
};

const UP = new Vector3(0, 1, 0);
const DEGREES = Math.PI / 180;
const RADIUS = new Map(PLANETS.map((planet) => [planet.id, planet.radius]));

/**
 * The travel curve: a soft start, most of the distance covered early, and a
 * long settle. `1 - (1 - t^1.6)^3` has zero slope at both ends, so the camera
 * neither lurches away nor bumps into place, and it is monotonic, so there is
 * no overshoot to correct.
 */
export function travelEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 - Math.pow(1 - Math.pow(t, 1.6), 3);
}

/** The aim leads the flight: the camera has turned to its subject by this
 * fraction of the move and spends the rest closing in on it. */
const TARGET_LEAD = 0.82;

export function resolveSystemPose(
  framing: SolarFraming,
  into: CameraPose,
): CameraPose {
  into.position.fromArray(framing.position);
  into.target.fromArray(framing.target);
  into.fov = framing.fov;
  return into;
}

// Scratch space. There is one camera controller per canvas and one canvas in
// the app, and none of these outlives a call, so module scope is safe and
// nothing is allocated per frame.
const radial = new Vector3();
const trailing = new Vector3();
const view = new Vector3();
const forward = new Vector3();
const right = new Vector3();
const screenUp = new Vector3();

/**
 * A camera composed around a body at `body` (world space).
 *
 * The frame is the orbit's: the Sun is the origin and every body turns about
 * +Y with an increasing angle (`Planet.tsx` places it at `(cos a, 0, -sin a)`),
 * so its direction of travel is `(-sin a, 0, -cos a)`. The camera trails the
 * body along that path and is swung towards the Sun by `azimuth`, which keeps
 * the Sun on the left of the frame for every orbital position.
 */
export function resolveBodyPose(
  tier: BodyCameraTier,
  body: Vector3,
  radius: number,
  aspect: number,
  into: CameraPose,
): CameraPose {
  radial.set(body.x, 0, body.z);
  if (radial.lengthSq() < 1e-8) radial.set(1, 0, 0);
  else radial.normalize();
  trailing.set(-radial.z, 0, radial.x);

  const azimuth = tier.azimuth * DEGREES;
  const elevation = tier.elevation * DEGREES;
  // Unit length: the horizontal part is perpendicular to UP.
  view
    .copy(trailing)
    .multiplyScalar(Math.cos(azimuth))
    .addScaledVector(radial, -Math.sin(azimuth))
    .multiplyScalar(Math.cos(elevation))
    .addScaledVector(UP, Math.sin(elevation));

  const distance = tier.distance * radius;
  into.position.copy(body).addScaledVector(view, distance);

  // Aim off the body by exactly the angle that lands its centre on `screen`.
  // The camera basis is the one `lookAt` will build: right = forward x up.
  forward.copy(view).negate();
  right.crossVectors(forward, UP).normalize();
  screenUp.crossVectors(right, forward);
  const tanV = Math.tan((tier.fov * DEGREES) / 2);
  into.target
    .copy(body)
    .addScaledVector(right, -tier.screen[0] * distance * tanV * aspect)
    .addScaledVector(screenUp, -tier.screen[1] * distance * tanV);
  into.fov = tier.fov;
  return into;
}

/**
 * Resolves a destination for this frame. Returns whether it is composed around
 * a body, in which case that body's world position has been written to
 * `bodyInto`.
 */
export function resolveDestination(
  id: UniverseDestinationId,
  context: PoseContext,
  into: CameraPose,
  bodyInto: Vector3,
): boolean {
  const camera = UNIVERSE_DESTINATIONS[id].camera;
  const node = camera.kind === "body" ? context.bodies.get(camera.body) : null;
  if (camera.kind === "system" || !node) {
    // A body that is not mounted yet has nowhere to be framed from; the system
    // shot is the only honest fallback, and it is corrected on the next frame
    // the body exists.
    resolveSystemPose(context.framing, into);
    return false;
  }
  node.getWorldPosition(bodyInto);
  resolveBodyPose(
    bodyCameraTier(camera.tiers, context.aspect),
    bodyInto,
    RADIUS.get(camera.body) ?? 1,
    context.aspect,
    into,
  );
  return true;
}

const offsetFrom = new Vector3();
const offsetTo = new Vector3();
const direction = new Vector3();
const aimFrom = new Vector3();
const aimTo = new Vector3();
const swing = new Quaternion();
const partial = new Quaternion();
const IDENTITY = new Quaternion();

/**
 * The pose `progress` of the way from one pose to another.
 *
 * With a pivot — the body being arrived at or left — the camera does not travel
 * a straight line through space. Its offset from the body is swung from one
 * direction to the other and its distance is interpolated geometrically, so the
 * body grows on screen at an even rate instead of ballooning in the last few
 * frames, and the path curves gently down onto the body's orbital plane. Both
 * ends are relative to the body's live position, so a body that moves during
 * the flight is still exactly where the camera lands.
 */
export function blendPoses(
  from: CameraPose,
  to: CameraPose,
  progress: number,
  pivot: Vector3 | null,
  into: CameraPose,
): CameraPose {
  const travel = travelEase(progress);
  const aim = travelEase(Math.min(1, progress / TARGET_LEAD));
  into.fov = from.fov + (to.fov - from.fov) * travel;

  offsetFrom.subVectors(from.position, pivot ?? from.position);
  offsetTo.subVectors(to.position, pivot ?? from.position);
  const lengthFrom = offsetFrom.length();
  const lengthTo = offsetTo.length();
  if (!pivot || lengthFrom < 1e-6 || lengthTo < 1e-6) {
    into.position.lerpVectors(from.position, to.position, travel);
    into.target.lerpVectors(from.target, to.target, aim);
    return into;
  }

  offsetFrom.divideScalar(lengthFrom);
  offsetTo.divideScalar(lengthTo);
  swing.setFromUnitVectors(offsetFrom, offsetTo);
  partial.slerpQuaternions(IDENTITY, swing, travel);
  direction.copy(offsetFrom).applyQuaternion(partial);
  const length = lengthFrom * Math.pow(lengthTo / lengthFrom, travel);
  into.position.copy(pivot).addScaledVector(direction, length);

  aimFrom.subVectors(from.target, pivot);
  aimTo.subVectors(to.target, pivot);
  into.target.copy(pivot).add(aimFrom.lerp(aimTo, aim));
  return into;
}

const fromPose = createPose();
const toPose = createPose();
const fromBody = new Vector3();
const toBody = new Vector3();

/** The camera pose the rig describes right now. */
export function evaluateRig(
  rig: CameraRig,
  context: PoseContext,
  into: CameraPose,
): CameraPose {
  const toIsBody = resolveDestination(rig.to, context, toPose, toBody);
  if (rig.progress >= 1) return copyPose(toPose, into);

  let fromIsBody = false;
  if (rig.from === "snapshot") copyPose(rig.snapshot, fromPose);
  else fromIsBody = resolveDestination(rig.from, context, fromPose, fromBody);

  const pivot = toIsBody ? toBody : fromIsBody ? fromBody : null;
  return blendPoses(fromPose, toPose, rig.progress, pivot, into);
}

/** How far the rig is focused on a body: 0 on a system shot, 1 at a body, and
 * in between during a move. Lets scene layers that only make sense from far
 * away — the orbit rings — recede as the camera closes in. */
export function bodyFocus(rig: CameraRig): number {
  const isBody = (id: UniverseDestinationId | "snapshot") =>
    id !== "snapshot" && UNIVERSE_DESTINATIONS[id].camera.kind === "body";
  const toBody = isBody(rig.to) ? 1 : 0;
  if (rig.progress >= 1) return toBody;
  // A snapshot start is treated as wherever the move is heading away from.
  const fromBody = rig.from === "snapshot" ? 1 - toBody : isBody(rig.from) ? 1 : 0;
  const t = travelEase(rig.progress);
  return fromBody + (toBody - fromBody) * t;
}

export function applyPose(camera: PerspectiveCamera, pose: CameraPose): void {
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  if (Math.abs(camera.fov - pose.fov) > 1e-4) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
}
