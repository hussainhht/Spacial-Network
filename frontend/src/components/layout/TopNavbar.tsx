"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavbarContext } from "./navbarContext";
import { useEffect, useRef, useState } from "react";
import AppIcon from "./AppIcon";
import { useNotifications } from "@/features/notifications/context/NotificationProvider";
import NotificationDropdown from "@/features/notifications/components/NotificationDropdown";
import { useSearchModal } from "@/features/search/context/SearchContext";
import UniversalNavbarSearch from "@/features/search/components/UniversalNavbarSearch";
import { useLogout } from "./useLogout";
import { getMyProfile } from "@/features/profile/api/profiles";
import type { Profile } from "@/features/profile/types/profile";
import { getBackendBaseUrl } from "@/lib/api";
import styles from "./TopNavbar.module.css";

function profilePhotoUrl(path?: string) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${getBackendBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export default function TopNavbar() {
  const pathname = usePathname();
  const context = getNavbarContext(pathname);
  const { isOpen, closeSearch } = useSearchModal();
  // Real notifications context
  const { unreadCount } = useNotifications();
  const { logout, loggingOut, error: logoutError } = useLogout();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuRoute, setMenuRoute] = useState(pathname);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  // Dropdown mockup state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  if (menuRoute !== pathname) {
    setMenuRoute(pathname);
    setNotificationsOpen(false);
    setUserMenuOpen(false);
    closeSearch();
  }
  if (isOpen && (notificationsOpen || userMenuOpen)) {
    setNotificationsOpen(false);
    setUserMenuOpen(false);
  }

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((profile) => {
        if (!cancelled) setCurrentProfile(profile);
      })
      .catch(() => undefined);

    function handleProfileUpdated(event: Event) {
      setCurrentProfile((event as CustomEvent<Profile>).detail);
    }

    window.addEventListener("profile-updated", handleProfileUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, []);

  useEffect(() => {
    if (!userMenuOpen && !notificationsOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        notificationsOpen &&
        bellRef.current &&
        !bellRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
      if (
        userMenuOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setUserMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        (userMenuOpen ? dropdownRef : bellRef).current
          ?.querySelector<HTMLButtonElement>("button")
          ?.focus();
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [userMenuOpen, notificationsOpen]);

  const userLabel = currentProfile
    ? currentProfile.nickname || currentProfile.firstName || currentProfile.username
    : "Account";
  const userPhoto = profilePhotoUrl(currentProfile?.profilePhoto);

  return (
    <nav className={styles.navbar} aria-label="Top navigation">
      {/* 1. Left Section: Page context */}
      <div className={styles.contextSection}>
        {/* Remounted per context so the section name crossfades with the route
            rather than swapping under the reader's eye. */}
        <div key={context.title} className={styles.contextText}>
          <span className={styles.contextEyebrow}>{context.eyebrow}</span>
          <h1 id="app-page-title" tabIndex={-1} className={styles.contextTitle}>
            {context.title}
          </h1>
        </div>
      </div>

      {/* 2. Search Bar: Universal Search Trigger (⌘K) */}
      <div
        className={`${styles.searchSection} ${
          isOpen ? styles.searchSectionOpen : ""
        }`}
      >
        <UniversalNavbarSearch />
      </div>

      {/* Right Section: Notifications & User Area */}
      <div className={styles.actionsSection}>

        {/* Notifications */}
        <div className={styles.bellWrapper} ref={bellRef}>
          <button
            type="button"
            className={styles.bellButton}
            onClick={() => {
              closeSearch();
              setMenuRoute(pathname);
              setNotificationsOpen((prev) => !(prev && menuRoute === pathname));
              setUserMenuOpen(false);
            }}
            aria-haspopup="true"
            aria-expanded={notificationsOpen && menuRoute === pathname}
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
            title="Notifications"
          >
            <AppIcon name="bell" />
            {unreadCount > 0 && (
              <span className={styles.notificationBadge} aria-hidden="true">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && menuRoute === pathname && (
            <NotificationDropdown
              onNavigate={() => setNotificationsOpen(false)}
            />
          )}
        </div>

        {/* 5. User Area */}
        <div className={styles.userWrapper} ref={dropdownRef}>
          <button
            type="button"
            className={styles.userButton}
            onClick={() => {
              closeSearch();
              setMenuRoute(pathname);
              setUserMenuOpen((prev) => !(prev && menuRoute === pathname));
              setNotificationsOpen(false);
            }}
            aria-haspopup="true"
            aria-expanded={userMenuOpen && menuRoute === pathname}
            aria-label="User account options"
          >
            <span className={styles.userAvatar} aria-hidden="true">
              {userPhoto ? (
                // User-uploaded images are served by the Go backend.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userPhoto} alt="" className={styles.userAvatarImage} />
              ) : (
                <AppIcon name="user" />
              )}
            </span>
            <span className={styles.userName}>{userLabel}</span>
            <span className={styles.chevronIcon} aria-hidden="true">
              <AppIcon name="chevronDown" />
            </span>
          </button>

          {userMenuOpen && menuRoute === pathname && (
            <div
              className={styles.userDropdown}
              role="menu"
              aria-label="User options"
            >
              <Link
                href="/profile"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}
              >
                Profile
              </Link>
              <Link
                href="/settings"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}
              >
                Settings
              </Link>
              <div className={styles.dropdownDivider} role="separator" />
              <button
                type="button"
                className={`${styles.dropdownItem} ${styles.dropdownItemLogout}`}
                role="menuitem"
                onClick={logout}
                disabled={loggingOut}
              >
                {loggingOut ? "Logging out…" : "Logout"}
              </button>
              {logoutError && (
                <p className={styles.dropdownError} role="alert">
                  {logoutError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
