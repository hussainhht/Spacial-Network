"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { getApiUrl } from "@/lib/api";
import AppIcon, { type AppIconName } from "./AppIcon";
import styles from "./AppShell.module.css";

const navigation: { href: string; label: string; icon: AppIconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/posts", label: "Posts", icon: "posts" },
  { href: "/groups", label: "Groups", icon: "groups" },
  { href: "/chat", label: "Messages", icon: "chat" },
  { href: "/profile", label: "Profile", icon: "user" },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  // Moved from the original Home page; retain the existing cookie-session logout.
  async function handleLogout() {
    setError("");
    setLoggingOut(true);
    try {
      const response = await fetch(getApiUrl("/logout"), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok && response.status !== 401) {
        throw new Error("Could not log out. Please try again.");
      }
      router.replace("/login");
    } catch {
      setError("Could not log out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <aside className={styles.sidebar} aria-label="Application sidebar">
      <Link href="/" className={styles.brand} aria-label="Social Network home">
        <span className={styles.brandIcon}><AppIcon name="orbit" /></span>
        <span className={styles.sidebarLabel}>Social Network<span className={styles.brandCaption}>A little more connected.</span></span>
      </Link>
      <div className={styles.navSection}>
        <p className={styles.sidebarLabel}>EXPLORE</p>
        <nav aria-label="Main navigation">
          {navigation.map(({ href, label, icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
            return (
              <Link key={href} href={href} className={styles.navLink} aria-current={active ? "page" : undefined} aria-label={label} title={label}>
                <AppIcon name={icon} /><span className={styles.sidebarLabel}>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className={styles.developmentNote}>
        <span className={styles.eyebrow}>A WORK IN PROGRESS</span>
        <p>A space to build together.</p>
        <span>Notifications and settings are still in development.</span>
      </div>
      <div className={styles.account}>
        {/* Temporary fallback: neither login nor an existing /me API exposes identity. */}
        <div className={styles.accountInfo} title="Account details unavailable until current-user information is exposed">
          <span className={styles.avatar}><AppIcon name="user" /></span>
          <span className={styles.sidebarLabel}><strong>Account</strong><small>Details unavailable</small></span>
        </div>
        <button type="button" onClick={handleLogout} disabled={loggingOut} className={styles.logout} aria-label={loggingOut ? "Logging out" : "Logout"} title="Logout">
          <AppIcon name="logout" /><span className={styles.sidebarLabel}>{loggingOut ? "Logging out…" : "Logout"}</span>
        </button>
        {error && <p className={styles.logoutError} role="alert">{error}</p>}
      </div>
    </aside>
  );
}
