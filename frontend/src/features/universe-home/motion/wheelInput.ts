/** Wheel deltas arrive in pixels, lines or pages depending on the device and
 * the browser. Normalising them here means the gesture thresholds mean one
 * thing everywhere, and keeps the arithmetic testable without React. */

const LINE_HEIGHT = 16;

export function normalizeWheelDelta(
  event: Pick<WheelEvent, "deltaX" | "deltaY" | "deltaMode">,
  pageHeight: number,
): number {
  const { deltaY, deltaX, deltaMode } = event;
  // A horizontal-only trackpad swipe still reads as travel through the system.
  const raw = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
  if (deltaMode === 1) return raw * LINE_HEIGHT;
  if (deltaMode === 2) return raw * pageHeight;
  return raw;
}
