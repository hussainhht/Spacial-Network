export const NEAR_BOTTOM_THRESHOLD_PX = 80;

export function isNearBottom(
  element: HTMLElement,
  threshold: number = NEAR_BOTTOM_THRESHOLD_PX
): boolean {
  const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
  return distance <= threshold;
}

export function scrollToBottom(
  element: HTMLElement,
  smooth: boolean = true
): void {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  element.scrollTo({
    top: element.scrollHeight,
    behavior: smooth && !prefersReducedMotion ? "smooth" : "instant",
  });
}

export function getScrollOffsetFromBottom(element: HTMLElement): number {
  return element.scrollHeight - element.scrollTop;
}

export function restoreScrollOffsetFromBottom(
  element: HTMLElement,
  offsetFromBottom: number
): void {
  element.scrollTop = element.scrollHeight - offsetFromBottom;
}

