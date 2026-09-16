"use client";

import { useCallback, useEffect, useRef } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { useSearchModal } from "../context/SearchContext";
import {
  useUniversalSearch,
  type NavigableItem,
} from "../hooks/useUniversalSearch";
import type { SearchCategory } from "../types/search";
import styles from "./UniversalNavbarSearch.module.css";

const CATEGORIES: { id: SearchCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "users", label: "People" },
  { id: "groups", label: "Groups" },
  { id: "posts", label: "Posts" },
  { id: "events", label: "Events" },
];

export default function UniversalNavbarSearch() {
  const { isOpen, openSearch, closeSearch } = useSearchModal();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const categoryRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const {
    query,
    setQuery,
    category,
    setCategory,
    isLoading,
    error,
    retrySearch,
    recentSearches,
    clearRecentSearches,
    removeRecentSearch,
    navigableItems,
    activeIndex,
    setActiveIndex,
    selectItem,
    handleKeyDown,
  } = useUniversalSearch(closeSearch);

  const closeAndRestoreFocus = useCallback(() => {
    closeSearch();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [closeSearch]);

  function handleCategoryKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + CATEGORIES.length) % CATEGORIES.length;
    } else if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % CATEGORIES.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = CATEGORIES.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    setCategory(CATEGORIES[nextIndex].id);
    categoryRefs.current[nextIndex]?.focus();
  }

  // Auto-focus input when search opens
  useEffect(() => {
    if (isOpen) {
      const timeoutId = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeAndRestoreFocus();
      }
    }

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        closeAndRestoreFocus();
      }
    }

    window.addEventListener("keydown", handleGlobalKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, closeAndRestoreFocus]);

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
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.profile_photo}
              alt={item.title}
              onError={(e) => {
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
            /* eslint-disable-next-line @next/next/no-img-element */
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

  // When closed: show the sleek trigger button in the navbar
  if (!isOpen) {
    return (
      <div className={styles.searchContainer}>
        <button
          ref={triggerRef}
          type="button"
          className={styles.searchTriggerButton}
          onClick={openSearch}
          aria-label="Open universal search (⌘K)"
          title="Open universal search (⌘K)"
        >
          <span className={styles.searchIconWrapper} aria-hidden="true">
            <AppIcon name="search" />
          </span>
          <span className={styles.searchTriggerPlaceholder}>
            Search people, posts, groups...
          </span>
          <kbd className={styles.kbdBadge}>⌘K</kbd>
        </button>
      </div>
    );
  }

  // When open: active input in navbar with connected dropdown extending downwards
  return (
    <div
      ref={searchContainerRef}
      className={styles.searchContainer}
    >
      {/* 1. Active Search Input Bar connected in the TopNavbar */}
      <div className={styles.searchBarActive}>
        <span className={styles.searchIconWrapper} aria-hidden="true">
          {isLoading ? (
            <span className={styles.spinner} aria-label="Searching..." />
          ) : (
            <AppIcon name="search" />
          )}
        </span>
        <input
          ref={inputRef}
          type="search"
          className={styles.searchInput}
          placeholder="Search people, groups, posts, events, shortcuts..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
          aria-label="Search across the platform"
          role="combobox"
          aria-expanded="true"
          aria-controls="universal-search-results"
          aria-autocomplete="list"
          aria-activedescendant={
            navigableItems[activeIndex]
              ? `search-option-${navigableItems[activeIndex].id}`
              : undefined
          }
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
          <button
            type="button"
            className={styles.escPill}
            onClick={closeAndRestoreFocus}
            title="Close search (Esc)"
            aria-label="Close search"
          >
            ESC
          </button>
        )}
      </div>

      {/* 2. Connected Dropdown Tray extending downwards from the top bar */}
      <div
        id="universal-search-results"
        className={styles.dropdownTray}
        role="listbox"
        aria-label="Search results"
      >
        {/* Category filter tabs */}
        <div
          className={styles.tabsBar}
          role="tablist"
          aria-label="Filter categories"
        >
          {CATEGORIES.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => {
                categoryRefs.current[index] = element;
              }}
              type="button"
              role="tab"
              aria-selected={category === tab.id}
              tabIndex={category === tab.id ? 0 : -1}
              className={`${styles.tabChip} ${
                category === tab.id ? styles.tabChipActive : ""
              }`}
              onClick={() => {
                setCategory(tab.id);
                inputRef.current?.focus();
              }}
              onKeyDown={(event) => handleCategoryKeyDown(event, index)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results List */}
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
                  <span key={term} className={styles.recentItem}>
                    <button
                      type="button"
                      className={styles.recentChip}
                      onClick={() => {
                        setQuery(term);
                        inputRef.current?.focus();
                      }}
                    >
                      {term}
                    </button>
                    <button
                      type="button"
                      className={styles.recentRemove}
                      onClick={() => removeRecentSearch(term)}
                      title="Remove recent search"
                      aria-label={`Remove recent search ${term}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {error && query.trim() && !isLoading && (
            <div className={styles.searchError} role="alert">
              <span>{error}</span>
              <button type="button" onClick={retrySearch}>
                Try again
              </button>
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
                  <button
                    key={item.id}
                    id={`search-option-${item.id}`}
                    type="button"
                    ref={isActive ? activeItemRef : null}
                    className={`${styles.resultItem} ${
                      isActive ? styles.resultItemActive : ""
                    }`}
                    onClick={() => selectItem(item)}
                    onMouseEnter={() => setActiveIndex(index)}
                    role="option"
                    aria-selected={isActive}
                  >
                    <div className={styles.itemAvatar}>
                      {renderItemIcon(item)}
                    </div>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemTitleRow}>
                        <span className={styles.itemTitle}>{item.title}</span>
                        {item.badge && (
                          <span className={styles.itemBadge}>{item.badge}</span>
                        )}
                      </div>
                      {item.subtitle && (
                        <span className={styles.itemSubtitle}>
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                    <div className={styles.itemActionIcon}>
                      <AppIcon name="arrow" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : query.trim() && !isLoading && !error ? (
            <div className={styles.stateBox}>
              <div className={styles.stateIcon}>
                <AppIcon name="search" />
              </div>
              <div className={styles.stateTitle}>No results found</div>
              <div className={styles.stateSubtitle}>
                We couldn&apos;t find anything matching &ldquo;{query.trim()}
                &rdquo;. Try another term or switch categories.
              </div>
            </div>
          ) : null}
        </div>

        {/* Dropdown Footer hints */}
        <div className={styles.dropdownFooter}>
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
          <div className={styles.footerBrand}>
            <span>Cosmic Universal Search</span>
          </div>
        </div>
      </div>
    </div>
  );
}
