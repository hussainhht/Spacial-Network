"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getNavbarContext } from "./navbarContext";
import { shellLayoutFor } from "./shellLayout";
import { useGroupsSearch } from "@/features/groups/context/GroupsSearchProvider";
import GroupSearchInput from "@/features/groups/components/GroupSearchInput";
import { useUniverseTransition } from "@/features/universe-transition/UniverseTransitionProvider";
import { useEffect, useRef, useState } from "react";
import AppIcon from "./AppIcon";
import { useNotifications } from "@/features/notifications/context/NotificationProvider";
import NotificationDropdown from "@/features/notifications/components/NotificationDropdown";
import { useSidebar } from "./sidebarContext";
import styles from "./TopNavbar.module.css";

export default function TopNavbar() {
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const context = getNavbarContext(pathname);
  const { search, setSearch } = useGroupsSearch();
  const { isTransitioning, navigate } = useUniverseTransition();
  // Navbar-only routes have no sidebar to toggle. The same slot carries the way
  // back to the universe instead, which is the only navigation they need — see
  // `shellLayout.ts`.
  const universe = shellLayoutFor(pathname) === "universe";

  function returnToUniverse() {
    // A move already owns the scene; a second click must not start another.
    if (isTransitioning) return;
    // Ask the cinematic first, then navigate explicitly. Never `router.back()`:
    // browser history can point at a login screen or another site entirely.
    if (!navigate("/")) router.push("/");
  }
  // Real notifications context
  const { unreadCount } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuRoute, setMenuRoute] = useState(pathname);
  const bellRef = useRef<HTMLDivElement>(null);

  // Visual-only input state (no API, no filtering, no side-effects)
  const [searchValue, setSearchValue] = useState("");

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
      {/* 1. Left Section: Universe return (or sidebar toggle) & page context */}
      <div className={styles.contextSection}>
        {universe ? (
          pathname !== "/" && (
            <button
              type="button"
              onClick={returnToUniverse}
              className={styles.universeButton}
              aria-label="Return to the universe"
              title="Return to the universe"
            >
              <span className={styles.universeIcon} aria-hidden="true">
                <AppIcon name="arrowLeft" />
              </span>
              <span className={styles.universeText}>Universe</span>
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={toggleSidebar}
            className={styles.sidebarToggle}
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            <AppIcon name={sidebarOpen ? "panelLeftClose" : "panelLeftOpen"} />
          </button>
        )}
        {/* Remounted per context so the section name crossfades with the route
            rather than swapping under the reader's eye. */}
        <div key={context.title} className={styles.contextText}>
          <span className={styles.contextEyebrow}>{context.eyebrow}</span>
          <h1 id="app-page-title" tabIndex={-1} className={styles.contextTitle}>
            {context.title}
          </h1>
        </div>
      </div>

      {/* 2. Search Bar: Visual placeholder only */}
      <div className={styles.searchSection} inert={isTransitioning}>
        {context.searchMode === "groups" ? (
          <GroupSearchInput value={search} onChange={setSearch} />
        ) : (
          <div className={styles.searchBar}>
            <span className={styles.searchIcon} aria-hidden="true">
              <AppIcon name="search" />
            </span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search people, posts, groups..."
              aria-label="Search people, posts, groups"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* 3, 4, 5. Right Section: New Post, Notifications & User Area */}
      <div className={styles.actionsSection}>
        {/* 3. New Post Button */}
        {context.action && (
          <Link
            inert={isTransitioning}
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
              <button
                type="button"
                className={styles.dropdownItem}
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}
              >
                Settings
              </button>
              <div className={styles.dropdownDivider} role="separator" />
              <button
                type="button"
                className={`${styles.dropdownItem} ${styles.dropdownItemLogout}`}
                role="menuitem"
                onClick={() => setUserMenuOpen(false)}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
