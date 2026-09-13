"use client";

import { usePathname } from "next/navigation";
import NavigationItem from "./NavigationItem";
import { PRIMARY_NAVIGATION, isNavItemActive } from "./navigation.config";
import styles from "./MobileBottomNav.module.css";

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className={styles.bottomNav}>
      <div className={styles.navList}>
        {PRIMARY_NAVIGATION.map((item) => (
          <NavigationItem
            key={item.href}
            item={item}
            active={isNavItemActive(pathname, item.href)}
            className={`${styles.navItem} ${item.emphasis ? styles.navItemEmphasis : ""}`}
            iconWrapClassName={styles.navIcon}
            labelClassName={styles.navLabel}
          />
        ))}
      </div>
    </nav>
  );
}
