"use client";

import { usePathname } from "next/navigation";
import { useSidebar } from "../sidebarContext";
import NavigationItem from "./NavigationItem";
import { PRIMARY_NAVIGATION, isNavItemActive } from "./navigation.config";
import styles from "./FloatingOrbitalNav.module.css";

export default function FloatingOrbitalNav() {
  const { isOpen } = useSidebar();
  const pathname = usePathname();

  return (
    <nav
      id="orbital-navigation"
      aria-label="Primary navigation"
      className={styles.orbitalNav}
      data-open={isOpen}
      inert={!isOpen ? true : undefined}
    >
      <svg
        className={styles.orbit}
        viewBox="0 0 190 460"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path className={styles.secondaryOrbit} d="M12 14 C116 132 116 328 12 446" />
        <path className={styles.primaryOrbit} d="M30 46 Q106 230 30 414" />
        <g className={styles.satellites}>
          <circle cx="47" cy="92" r="2" />
          <circle cx="65" cy="276" r="1.5" />
          <circle cx="47" cy="368" r="2" />
          <path d="M96 16 v8 M92 20 h8" />
        </g>
      </svg>
      <div className={styles.destinations}>
        {PRIMARY_NAVIGATION.map((item) => (
          <NavigationItem
            key={item.href}
            item={item}
            active={isNavItemActive(pathname, item.href)}
            className={styles.destination}
          />
        ))}
      </div>
    </nav>
  );
}
