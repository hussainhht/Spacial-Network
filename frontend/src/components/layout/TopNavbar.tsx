"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AppIcon from "./AppIcon";
import { useNotifications } from "@/features/notifications/context/NotificationProvider";
import NotificationDropdown from "@/features/notifications/components/NotificationDropdown";
import styles from "./TopNavbar.module.css";

export default function TopNavbar() {
  // Real notifications context
  const { unreadCount } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  // Visual-only input state (no API, no filtering, no side-effects)
  const [searchValue, setSearchValue] = useState("");

  // Dropdown mockup state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <nav data-universe-ui className={styles.navbar} aria-label="Top navigation">
      {/* 1. Left Section: Current page context */}
      <div className={styles.contextSection}>
        <span className={styles.contextEyebrow}>YOUR ORBIT</span>
        <span className={styles.contextTitle}>Home</span>
      </div>

      {/* 2. Search Bar: Visual placeholder only */}
      <div className={styles.searchSection}>
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
      </div>

      {/* 3, 4, 5. Right Section: New Post, Notifications & User Area */}
      <div className={styles.actionsSection}>
        {/* 3. New Post Button */}
        <Link
          href="/posts/new"
          className={styles.newPostButton}
          aria-label="Create new post"
        >
          <span className={styles.newPostIcon} aria-hidden="true">
            <AppIcon name="plus" />
          </span>
          <span className={styles.newPostText}>New Post</span>
        </Link>

        {/* 4. Notifications */}
        <div className={styles.bellWrapper} ref={bellRef}>
          <button
            type="button"
            className={styles.bellButton}
            onClick={() => {
              setNotificationsOpen((prev) => !prev);
              setUserMenuOpen(false);
            }}
            aria-haspopup="true"
            aria-expanded={notificationsOpen}
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

          {notificationsOpen && (
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
              setUserMenuOpen((prev) => !prev);
              setNotificationsOpen(false);
            }}
            aria-haspopup="true"
            aria-expanded={userMenuOpen}
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

          {userMenuOpen && (
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
