"use client";

import type { ReactNode } from "react";

import { getDisplayName, getInitials } from "@/lib/utils";
import { avatarUrl } from "../../api/groups";
import { useInviteUserSearch } from "../../hooks/useInviteUserSearch";
import type { InviteCandidate } from "../../types/group";

interface InviteUserSearchProps {
  groupId: number;
  renderAction: (user: InviteCandidate) => ReactNode;
  autoFocus?: boolean;
}

export default function InviteUserSearch({
  groupId,
  renderAction,
  autoFocus = false,
}: InviteUserSearchProps) {
  const {
    isConnected,
    query,
    setQuery,
    results,
    loading,
    errorMessage,
    wsErrorPending,
  } = useInviteUserSearch(groupId);

  const trimmedQuery = query.trim();

  return (
    <section className="group-invite-search">
      <div className="form-field">
        <label htmlFor={`invite-search-${groupId}`}>
          Search by name or username
        </label>

        <div className="group-invite-input-wrap">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            id={`invite-search-${groupId}`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people to invite..."
            disabled={!isConnected}
            autoFocus={autoFocus}
            autoComplete="off"
          />
        </div>
      </div>

      {!isConnected && (
        <p className="group-invite-status" role="status">
          Reconnecting to the server…
        </p>
      )}
      {loading && !wsErrorPending && (
        <p className="group-invite-status group-invite-loading" role="status">
          <span className="group-invite-spinner" aria-hidden="true" />
          Searching…
        </p>
      )}
      {wsErrorPending && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}

      {!loading && !wsErrorPending && trimmedQuery.length === 0 && (
        <p className="group-invite-status">
          Search for people to invite to this group.
        </p>
      )}

      {!loading &&
        !wsErrorPending &&
        trimmedQuery.length > 0 &&
        results.length === 0 && (
          <p className="group-invite-status">No people found.</p>
        )}

      {results.length > 0 && (
        <ul className="group-invite-results">
          {results.map((user) => {
            const displayName = getDisplayName(
              user.firstName,
              user.lastName,
              user.username,
            );
            const initials = getInitials(
              user.firstName,
              user.lastName,
              user.username,
            );
            const photo = avatarUrl(user.avatar);

            return (
              <li key={user.id} className="group-invite-result">
                <div className="group-invite-result-info">
                  {photo ? (
                    <img
                      className="group-invite-avatar"
                      src={photo}
                      alt=""
                      width={36}
                      height={36}
                    />
                  ) : (
                    <span
                      className="group-invite-avatar-fallback"
                      aria-hidden="true"
                    >
                      {initials}
                    </span>
                  )}

                  <span className="group-invite-result-text">
                    <span className="group-invite-result-name">
                      {displayName}
                    </span>
                    <span className="group-invite-result-username">
                      @{user.username}
                    </span>
                  </span>
                </div>

                <div className="group-invite-result-action">
                  {renderAction(user)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
