"use client";

import type { ReactNode } from "react";

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
      {!isConnected && (
        <p className="group-invite-status">Reconnecting to the server...</p>
      )}

      <div className="form-field">
        <label htmlFor={`invite-search-${groupId}`}>
          Search by name or username
        </label>

        <input
          id={`invite-search-${groupId}`}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people to invite..."
          disabled={!isConnected}
          autoFocus={autoFocus}
        />
      </div>

      {loading && !wsErrorPending && (
        <p className="group-invite-status">Searching...</p>
      )}
      {wsErrorPending && <p className="form-error">{errorMessage}</p>}

      {!loading && !wsErrorPending && trimmedQuery.length === 0 && (
        <p className="group-invite-status">
          Search for people you’d like to invite.
        </p>
      )}

      {!loading &&
        !wsErrorPending &&
        trimmedQuery.length > 0 &&
        results.length === 0 && (
          <p className="group-invite-status">No users found.</p>
        )}

      {results.length > 0 && (
        <ul className="group-invite-results">
          {results.map((user) => {
            const fullName = [user.firstName, user.lastName]
              .filter(Boolean)
              .join(" ");
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
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  )}

                  <span className="group-invite-result-text">
                    <span className="group-invite-result-name">
                      {fullName || user.username}
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
