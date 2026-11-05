"use client";

import Link from "next/link";
import { DEMO_MODE } from "@/demo/config";
import DemoControls from "@/demo/DemoControls";
import AboutDemoModal from "@/demo/AboutDemoModal";
import { usePathname } from "next/navigation";
import { getNavbarContext } from "./navbarContext";
import { useEffect, useRef, useState } from "react";
import AppIcon from "./AppIcon";
import UserAvatar from "@/components/UserAvatar";
import { useCurrentUser } from "@/features/auth/context/CurrentUserContext";
import { getDisplayName } from "@/lib/utils";
import { useNotifications } from "@/features/notifications/context/NotificationProvider";
import NotificationDropdown from "@/features/notifications/components/NotificationDropdown";
import { useSearchModal } from "@/features/search/context/SearchContext";
import UniversalNavbarSearch from "@/features/search/components/UniversalNavbarSearch";
import { useLogout } from "./useLogout";
import styles from "./TopNavbar.module.css";

export default function TopNavbar() {
  const pathname = usePathname();
  const context = getNavbarContext(pathname);
  const { isOpen, closeSearch } = useSearchModal();
  // Real notifications context
  const { unreadCount } = useNotifications();
  const { logout, loggingOut, error: logoutError } = useLogout();
  const { user } = useCurrentUser();
  const displayName = getDisplayName(user.first_name, user.last_name, user.username);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuRoute, setMenuRoute] = useState(pathname);
  const bellRef = useRef<HTMLDivElement>(null);

  // Dropdown mockup state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const demoBadgeRef = useRef<HTMLButtonElement>(null);
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
    if (!isOpen) return;
    const timeoutId = window.setTimeout(() => {
      setNotificationsOpen(false);
      setUserMenuOpen(false);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

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

    // Move focus into the menu when it opens so keyboard users can Tab through it.
    if (userMenuOpen) {
      dropdownRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [userMenuOpen, notificationsOpen]);

  return (
    <nav className={styles.navbar} aria-label="Top navigation">
      {/* 1. Left Section: Page context */}
      <div className={styles.contextSection}>
        {/* Remounted per context so the section name crossfades with the route
            rather than swapping under the reader's eye. */}
        <div key={context.title} className={styles.contextText}>
          <span className={styles.contextEyebrow}>{context.eyebrow}</span>
          <div className={styles.titleRow}>
            <h1 id="app-page-title" tabIndex={-1} className={styles.contextTitle}>
              {context.title}
            </h1>
            {DEMO_MODE && (
              <button
                ref={demoBadgeRef}
                type="button"
                className={styles.demoPill}
                onClick={() => setAboutOpen(true)}
                aria-haspopup="dialog"
                aria-label="Demo mode. Learn about this demo"
              >
                Demo
              </button>
            )}
          </div>
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
            <UserAvatar
              src={user.profile_photo}
              firstName={user.first_name}
              lastName={user.last_name}
              username={user.username}
              size={32}
              alt=""
              className={styles.userAvatar}
            />
            <span className={styles.userName}>{displayName}</span>
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
              <div className={styles.dropdownUser}>
                <UserAvatar
                  src={user.profile_photo}
                  firstName={user.first_name}
                  lastName={user.last_name}
                  username={user.username}
                  size={36}
                  alt=""
                  className={styles.userAvatar}
                />
                <div className={styles.dropdownUserText}>
                  <span className={styles.dropdownUserName}>{displayName}</span>
                  <span className={styles.dropdownUserHandle}>
                    @{user.username}
                  </span>
                </div>
              </div>
              <div className={styles.dropdownDivider} role="separator" />
              <Link
                href="/profile"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}
              >
                <AppIcon name="user" />
                My Profile
              </Link>
              <Link
                href="/settings"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}
              >
                <AppIcon name="settings" />
                Settings
              </Link>
              <div className={styles.dropdownDivider} role="separator" />
              <button
                type="button"
                className={`${styles.dropdownItem} ${DEMO_MODE ? "" : styles.dropdownItemLogout}`}
                role="menuitem"
                onClick={logout}
                disabled={loggingOut}
                aria-busy={loggingOut}
              >
                <AppIcon name="logOut" />
                {DEMO_MODE ? "Demo entry" : loggingOut ? "Signing out…" : "Sign out"}
              </button>
              {DEMO_MODE && (
                <DemoControls
                  onAbout={() => {
                    setUserMenuOpen(false);
                    setAboutOpen(true);
                  }}
                />
              )}
              {logoutError && (
                <p className={styles.dropdownError} role="alert">
                  {logoutError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      {DEMO_MODE && aboutOpen && (
        <AboutDemoModal
          onClose={() => setAboutOpen(false)}
          fallbackFocus={demoBadgeRef}
        />
      )}
    </nav>
  );
}
