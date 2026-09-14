"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavbarContext } from "./navbarContext";
import { useGroupsSearch } from "@/features/groups/context/GroupsSearchProvider";
import GroupSearchInput from "@/features/groups/components/GroupSearchInput";
import { useEffect, useRef, useState } from "react";
import AppIcon from "./AppIcon";
import { useNotifications } from "@/features/notifications/context/NotificationProvider";
import NotificationDropdown from "@/features/notifications/components/NotificationDropdown";
import { useSearchModal } from "@/features/search/context/SearchContext";
import { useLogout } from "./useLogout";
import styles from "./TopNavbar.module.css";

export default function TopNavbar() {
  const pathname = usePathname();
  const context = getNavbarContext(pathname);
  const { search, setSearch } = useGroupsSearch();
  const { openSearch } = useSearchModal();
  // Real notifications context
  const { unreadCount } = useNotifications();
  const { logout, loggingOut, error: logoutError } = useLogout();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuRoute, setMenuRoute] = useState(pathname);
  const bellRef = useRef<HTMLDivElement>(null);

  // Dropdown mockup state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  if (menuRoute !== pathname) {
    setMenuRoute(pathname);
    setNotificationsOpen(false);
    setUserMenuOpen(false);
  }

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
      <div className={styles.searchSection}>
        {context.searchMode === "groups" ? (
          <GroupSearchInput value={search} onChange={setSearch} />
        ) : (
          <button
            type="button"
            className={styles.searchBar}
            onClick={openSearch}
            aria-label="Open universal search (⌘K)"
            title="Open universal search (⌘K)"
            style={{
              cursor: "pointer",
              textAlign: "left",
              font: "inherit",
              width: "100%",
            }}
          >
            <span className={styles.searchIcon} aria-hidden="true">
              <AppIcon name="search" />
            </span>
            <span
              style={{
                flex: 1,
                fontSize: "13px",
                color: "var(--space-text-muted, #94a3b8)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Search people, posts, groups...
            </span>
            <kbd
              style={{
                padding: "2px 6px",
                borderRadius: "5px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                fontSize: "10px",
                fontWeight: 600,
                color: "#94a3b8",
                letterSpacing: "0.5px",
              }}
            >
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* 3, 4, 5. Right Section: New Post, Notifications & User Area */}
      <div className={styles.actionsSection}>
        {/* 3. New Post Button */}
        {context.action && (
          <Link

            href={context.action.href}
            className={styles.newPostButton}
            aria-label={context.action.ariaLabel}
          >
            <span className={styles.newPostIcon} aria-hidden="true">
              <AppIcon name="plus" />
            </span>
            <span className={styles.newPostText}>{context.action.label}</span>
          </Link>
        )}

        {/* 4. Notifications */}
        <div className={styles.bellWrapper} ref={bellRef}>
          <button
            type="button"
            className={styles.bellButton}
            onClick={() => {
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
              setMenuRoute(pathname);
              setUserMenuOpen((prev) => !(prev && menuRoute === pathname));
              setNotificationsOpen(false);
            }}
            aria-haspopup="true"
            aria-expanded={userMenuOpen && menuRoute === pathname}
            aria-label="User account options"
          >
            <span className={styles.userAvatar} aria-hidden="true">
              <AppIcon name="user" />
            </span>
            <span className={styles.userName}>You</span>
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
