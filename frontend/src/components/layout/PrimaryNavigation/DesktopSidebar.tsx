"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppIcon from "../AppIcon";
import { useSidebar } from "../sidebarContext";
import { useLogout } from "../useLogout";
import NavigationItem from "./NavigationItem";
import { PRIMARY_NAVIGATION, isNavItemActive } from "./navigation.config";
import styles from "./DesktopSidebar.module.css";

export default function DesktopSidebar() {
  const { isOpen, isReady } = useSidebar();
  const pathname = usePathname();
  const { logout, loggingOut, error } = useLogout();

  return (
    <aside
      id="app-sidebar"
      className={`${styles.sidebar} ${!isOpen ? styles.sidebarCollapsed : ""}`}
      aria-label="Application sidebar"
      inert={!isOpen ? true : undefined}
    >
      <Link href="/" className={styles.brand} aria-label="Social Network home">
        <span className={styles.brandIcon}>
          <AppIcon name="orbit" />
        </span>
        <span>
          Social Network
          <span className={styles.brandCaption}>A little more connected.</span>
        </span>
      </Link>

      <nav aria-label="Main navigation" className={styles.navList}>
        <div className={styles.navPath} aria-hidden="true" />
        {PRIMARY_NAVIGATION.map((item) => (
          <NavigationItem
            key={item.href}
            item={item}
            active={isReady && isNavItemActive(pathname, item.href)}
            className={`${styles.navLink} ${item.emphasis ? styles.navLinkEmphasis : ""}`}
            iconWrapClassName={styles.navIconNode}
            labelClassName={styles.navLabel}
          />
        ))}
      </nav>

      <div className={styles.account}>
        {/* Temporary fallback: neither login nor an existing /me API exposes identity. */}
        <div
          className={styles.accountInfo}
          title="Account details unavailable until current-user information is exposed"
        >
          <span className={styles.avatar}>
            <AppIcon name="user" />
          </span>
          <span className={styles.accountText}>
            <strong>Account</strong>
            <small>Details unavailable</small>
          </span>
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className={styles.logout}
          aria-label={loggingOut ? "Logging out" : "Logout"}
          title="Logout"
        >
          <span className={styles.logoutIcon}>
            <AppIcon name="logout" />
          </span>
          <span>{loggingOut ? "Logging out…" : "Logout"}</span>
        </button>
        {error && (
          <p className={styles.logoutError} role="alert">
            {error}
          </p>
        )}
      </div>
    </aside>
  );
}
