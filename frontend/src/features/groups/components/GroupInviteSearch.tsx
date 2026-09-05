"use client";

import { avatarUrl } from "../api/groups";
import { useGroupInvitation } from "../hooks/useGroupInvitation";
import { useInviteUserSearch } from "../hooks/useInviteUserSearch";

interface GroupInviteSearchProps {
  groupId: number;
}

export default function GroupInviteSearch({ groupId }: GroupInviteSearchProps) {
  const { isConnected, query, setQuery, results, loading, errorMessage, wsErrorPending } =
    useInviteUserSearch(groupId);
  const { invitingId, invitedIds, rowErrors, handleInvite } = useGroupInvitation(groupId);

  return (
    <section className="group-invite-search">
      <h2>Invite people</h2>

      {!isConnected && (
        <p className="group-invite-status">Reconnecting to the server...</p>
      )}

      <div className="form-field">
        <label htmlFor="invite-search">Search by name or username</label>

        <input
          id="invite-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or username"
          disabled={!isConnected}
        />
      </div>

      {loading && !wsErrorPending && (
        <p className="group-invite-status">Searching...</p>
      )}
      {wsErrorPending && <p className="form-error">{errorMessage}</p>}

      {!loading && !wsErrorPending && query.trim().length > 0 && results.length === 0 && (
        <p className="group-invite-status">No users found.</p>
      )}

      {results.length > 0 && (
        <ul className="group-invite-results">
          {results.map((user) => {
            const invited = invitedIds.includes(user.id);
            const rowError = rowErrors[user.id];
            const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
            const photo = avatarUrl(user.avatar);

            return (
              <li key={user.id} className="group-invite-result">
                <div className="group-invite-result-info">
                  {photo ? (
                    <img
                      className="group-invite-avatar"
                      src={photo}
                      alt=""
                      width={32}
                      height={32}
                    />
                  ) : (
                    <span className="group-invite-avatar-fallback" aria-hidden="true">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  )}

                  <span className="group-invite-result-name">
                    {user.username}
                    {fullName && ` (${fullName})`}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleInvite(user.id)}
                  disabled={invited || invitingId === user.id}
                >
                  {invited ? "Invited" : invitingId === user.id ? "Inviting..." : "Invite"}
                </button>

                {rowError && <p className="form-error">{rowError}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
