"use client";

import { useEffect, useRef } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { useUniversalSearch, type NavigableItem } from "../hooks/useUniversalSearch";
import type { SearchCategory } from "../types/search";
import styles from "./UniversalSearchModal.module.css";

interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: { id: SearchCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "users", label: "People" },
  { id: "groups", label: "Groups" },
  { id: "posts", label: "Posts" },
  { id: "events", label: "Events" },
];

export default function UniversalSearchModal({
  isOpen,
  onClose,
}: UniversalSearchModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  const {
    query,
    setQuery,
    category,
    setCategory,
    isLoading,
    recentSearches,
    clearRecentSearches,
    removeRecentSearch,
    navigableItems,
    activeIndex,
    setActiveIndex,
    selectItem,
    handleKeyDown,
  } = useUniversalSearch(onClose);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  const renderItemIcon = (item: NavigableItem) => {
    switch (item.type) {
      case "shortcut": {
        const iconName = ("icon" in item.data ? item.data.icon : "arrow") as
          | "home"
          | "posts"
          | "groups"
          | "chat"
          | "user"
          | "orbit"
          | "plus"
          | "bell";
        return <AppIcon name={iconName} />;
      }
      case "user": {
        const user = item.data as { profile_photo?: string; username: string };
        if (user.profile_photo) {
          return (
            <img
              src={user.profile_photo}
              alt={item.title}
              onError={(e) => {
                // Hide broken image
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          );
        }
        return <span>{item.title.charAt(0).toUpperCase()}</span>;
      }
      case "group": {
        const group = item.data as { group_photo?: string };
        if (group.group_photo) {
          return (
            <img
              src={group.group_photo}
              alt={item.title}
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          );
        }
        return <AppIcon name="groups" />;
      }
      case "post":
        return <AppIcon name="posts" />;
      case "event":
        return <AppIcon name="orbit" />;
      default:
        return <AppIcon name="search" />;
    }
  };

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Universal Search Command Palette"
    >
      <div className={styles.modal} onKeyDown={handleKeyDown}>
        {/* Top Search Input */}
        <div className={styles.header}>
          <div className={styles.searchIconWrapper}>
            {isLoading ? (
              <div className={styles.spinner} aria-label="Loading" />
            ) : (
              <AppIcon name="search" />
            )}
          </div>
          <input
            ref={inputRef}
            type="search"
            className={styles.searchInput}
            placeholder="Search people, groups, posts, events, shortcuts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search across the platform"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              type="button"
              className={styles.clearButton}
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              title="Clear search"
              aria-label="Clear search"
            >
              ×
            </button>
          ) : (
            <span className={styles.escPill}>ESC</span>
          )}
        </div>

        <div className={styles.tabsBar} role="tablist" aria-label="Search filter categories">
          {CATEGORIES.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={category === tab.id}
              className={`${styles.tabChip} ${
                category === tab.id ? styles.tabChipActive : ""
              }`}
              onClick={() => {
                setCategory(tab.id);
                inputRef.current?.focus();
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.resultsContent}>
          {!query.trim() && recentSearches.length > 0 && (
            <div>
              <div className={styles.sectionHeader}>
                <span>Recent Searches</span>
                <button
                  type="button"
                  className={styles.clearRecentsBtn}
                  onClick={clearRecentSearches}
                >
                  Clear all
                </button>
              </div>
              <div className={styles.recentsContainer}>
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    className={styles.recentChip}
                    onClick={() => {
                      setQuery(term);
                      inputRef.current?.focus();
                    }}
                  >
                    <span>{term}</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(term);
                      }}
                      title="Remove recent search"
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {navigableItems.length > 0 ? (
            <div>
              {!query.trim() && (
                <div className={styles.sectionHeader}>
                  <span>Quick Navigation</span>
                </div>
              )}
              {navigableItems.map((item, index) => {
                const isActive = index === activeIndex;
                return (
                  <div
                    key={item.id}
                    ref={isActive ? activeItemRef : null}
                    className={`${styles.resultItem} ${
                      isActive ? styles.resultItemActive : ""
                    }`}
                    onClick={() => selectItem(item)}
                    onMouseEnter={() => setActiveIndex(index)}
                    role="option"
                    aria-selected={isActive}
                  >
                    <div className={styles.itemAvatar}>{renderItemIcon(item)}</div>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemTitleRow}>
                        <span className={styles.itemTitle}>{item.title}</span>
                        {item.badge && (
                          <span className={styles.itemBadge}>{item.badge}</span>
                        )}
                      </div>
                      {item.subtitle && (
                        <span className={styles.itemSubtitle}>{item.subtitle}</span>
                      )}
                    </div>
                    <div className={styles.itemActionIcon}>
                      <AppIcon name="arrow" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : query.trim() && !isLoading ? (
            <div className={styles.stateBox}>
              <div className={styles.stateIcon}>
                <AppIcon name="search" />
              </div>
              <div className={styles.stateTitle}>No results found</div>
              <div className={styles.stateSubtitle}>
                We couldn&apos;t find anything matching &ldquo;{query.trim()}&rdquo;. Try another term or switch categories.
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerHints}>
            <span className={styles.hintItem}>
              <kbd className={styles.kbd}>↑</kbd>
              <kbd className={styles.kbd}>↓</kbd>
              <span>navigate</span>
            </span>
            <span className={styles.hintItem}>
              <kbd className={styles.kbd}>↵</kbd>
              <span>select</span>
            </span>
            <span className={styles.hintItem}>
              <kbd className={styles.kbd}>esc</kbd>
              <span>close</span>
            </span>
          </div>
          <div>
            <span>Cosmic Universal Search</span>
          </div>
        </div>
      </div>
    </div>
  );
}
