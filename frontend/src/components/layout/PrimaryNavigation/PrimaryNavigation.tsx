import DesktopSidebar from "./DesktopSidebar";
import MobileBottomNav from "./MobileBottomNav";

/**
 * Both variants render unconditionally and are driven by the same
 * navigation.config.ts; CSS media queries alone decide which one is visible
 * at a given viewport width, so there is no client-side breakpoint detection
 * (no hydration mismatch, no layout shift).
 */
export default function PrimaryNavigation() {
  return (
    <>
      <DesktopSidebar />
      <MobileBottomNav />
    </>
  );
}
