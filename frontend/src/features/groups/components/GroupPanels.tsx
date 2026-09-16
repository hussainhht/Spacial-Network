"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import UserAvatar from "@/components/UserAvatar";
import { createPortal } from "react-dom";
import { removeMember } from "../api/groups";
import { useGroupAction } from "../hooks/useGroupAction";
import {
  useGroupMembers,
  useMembership,
  usePendingInvitations,
  usePendingJoinRequests,
} from "../hooks/useGroupData";
import GroupInviteModal from "./management/GroupInviteModal";
import GroupJoinButton from "./GroupJoinButton";
import GroupPrivacyBadge from "./GroupPrivacyBadge";
import { InvitationActions, JoinRequestActions } from "./GroupResponseActions";
import type { Group, GroupPrivacy } from "../types/group";
import { formatDate } from "@/lib/utils/date";
import { getDisplayName } from "@/lib/utils";

export function GroupLoadError({
  error,
  retry,
}: {
  error: string;
  retry: () => Promise<void>;
}) {
  return (
    <div className="group-verification-error" role="alert">
      <span>{error}</span>
      <button
        type="button"
        className="group-button secondary"
        onClick={() => void retry()}
      >
        Retry
      </button>
    </div>
  );
}

export function MembershipBadge({
  role,
  pending,
  invited,
}: {
  role?: string;
  pending?: boolean;
  invited?: boolean;
}) {
  const state =
    role === "creator"
      ? "Creator"
      : role
        ? "Member"
        : invited
          ? "Invited"
          : pending
            ? "Request Pending"
            : "Not Member";

  return (
    <span
      className="group-badge"
      data-state={role || (invited ? "invited" : pending ? "pending" : "none")}
    >
      {state}
    </span>
  );
}

export function MembersPanel({
  group,
}: {
  group: Group;
}) {
  const groupId = group.id;
  const state = useGroupMembers(groupId);
  // Shares the same cached useMembership resource as other panels on this
  // page, so this does not trigger a second membership request.
  const membership = useMembership(groupId);
  const isCreator = membership.data?.role === "creator";
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const closeInviteModal = useCallback(() => setIsInviteModalOpen(false), []);
  const [removeTarget, setRemoveTarget] = useState<{
    userId: number;
    username: string;
  } | null>(null);
  const closeRemoveDialog = useCallback(() => setRemoveTarget(null), []);
  const filteredMembers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return state.data ?? [];
    return (state.data ?? []).filter((member) =>
      [member.firstName, member.lastName, member.username]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [search, state.data]);

  return (
    <div className="group-members-layout">
      <section
        className="group-panel group-members group-members-main"
        aria-labelledby="members-heading"
      >
        <div className="group-members-title-row">
          <div>
            <p className="group-eyebrow">Community roster</p>
            <h2 id="members-heading">Members</h2>
          </div>
          <span className="group-members-count">
            {state.data?.length ?? group.memberCount}{" "}
            {(state.data?.length ?? group.memberCount) === 1 ? "member" : "members"}
          </span>
        </div>
        <label className="group-member-search" htmlFor={`member-search-${groupId}`}>
          <span className="sr-only">Search members</span>
          <AppIcon name="search" width={17} height={17} />
          <input
            id={`member-search-${groupId}`}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members..."
            autoComplete="off"
          />
        </label>
        {state.error && (
          <GroupLoadError error={state.error} retry={state.refresh} />
        )}
        {state.loading && !state.data && (
          <div className="group-member-skeletons" role="status" aria-label="Loading members">
            {[0, 1, 2].map((item) => <span key={item} />)}
          </div>
        )}
        {state.data && filteredMembers.length > 0 && (
          <ul className="group-members-list" aria-label="Group members">
            {filteredMembers.map((member) => {
              const displayName = getDisplayName(
                member.firstName,
                member.lastName,
                member.username,
              );
              return (
                <li key={member.userId} className="group-member-item">
                  <UserAvatar
                    src={member.avatar}
                    firstName={member.firstName}
                    lastName={member.lastName}
                    username={member.username}
                    size="md"
                    alt=""
                    className="group-member-avatar"
                  />
                  <Link
                    className="group-member-identity"
                    href={`/profile/${encodeURIComponent(member.username)}`}
                  >
                    <span className="group-member-display-name">{displayName}</span>
                    <span className="group-member-handle">@{member.username}</span>
                  </Link>
                  {member.userId === group.creatorId ? (
                    <span className="group-member-role">Owner</span>
                  ) : (
                    isCreator && (
                      <button
                        type="button"
                        className="group-member-remove"
                        onClick={() =>
                          setRemoveTarget({
                            userId: member.userId,
                            username: member.username,
                          })
                        }
                      >
                        Remove
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!state.loading && state.data?.length === 0 && (
          <div className="group-members-empty">
            <h3>No members to display</h3>
            <p>Members will appear here after they join the group.</p>
          </div>
        )}
        {!state.loading && state.data && state.data.length > 0 && filteredMembers.length === 0 && (
          <div className="group-members-empty">
            <h3>No matching members</h3>
            <p>Try another name or username.</p>
          </div>
        )}
      </section>

      <aside className="group-members-sidebar" aria-label="Member tools and group stats">
        {isCreator && (
          <section className="group-panel group-members-invite-card" aria-labelledby="invite-members-card-title">
            <span className="group-side-card-icon" aria-hidden="true">✦</span>
            <h2 id="invite-members-card-title">Invite Members</h2>
            <p>Invite people directly to this group.</p>
            <button
              type="button"
              className="group-button group-invite-people-button"
              onClick={() => setIsInviteModalOpen(true)}
            >
              + Invite Members
            </button>
          </section>
        )}
        <section className="group-panel group-stats-card" aria-labelledby="group-stats-title">
          <h2 id="group-stats-title">Group Stats</h2>
          <dl>
            <div><dt>Members</dt><dd>{state.data?.length ?? group.memberCount}</dd></div>
            <div><dt>Privacy</dt><dd>{group.privacy === "private" ? "Private" : "Public"}</dd></div>
            <div><dt>Created</dt><dd>{formatDate(group.createdAt)}</dd></div>
          </dl>
        </section>
      </aside>
      <GroupInviteModal
        groupId={groupId}
        open={isInviteModalOpen}
        onClose={closeInviteModal}
      />
      <RemoveMemberDialog
        groupId={groupId}
        target={removeTarget}
        onClose={closeRemoveDialog}
      />
    </div>
  );
}

function RemoveMemberDialog({
  groupId,
  target,
  onClose,
}: {
  groupId: number;
  target: { userId: number; username: string } | null;
  onClose: () => void;
}) {
  const { busy, error, run } = useGroupAction(
    `remove-member:${target?.userId ?? 0}`,
    groupId,
  );

  useEffect(() => {
    if (!target) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [target, busy, onClose]);

  if (!target) return null;

  async function handleRemove() {
    if (!target) return;
    if (await run("Removing…", () => removeMember(groupId, target.userId)))
      onClose();
  }

  return createPortal(
    <div className="group-modal-overlay" onClick={() => !busy && onClose()}>
      <div
        className="group-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-member-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="group-modal-header">
          <h2 id="remove-member-title">Remove member?</h2>
          <button
            type="button"
            className="group-modal-close"
            aria-label="Cancel"
            disabled={Boolean(busy)}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="group-modal-body">
          <p className="group-muted">
            Are you sure you want to remove @{target.username} from this group?
            They will lose access to group-only content and chat.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="group-buttons">
            <button
              type="button"
              className="group-button secondary"
              disabled={Boolean(busy)}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="group-button danger"
              disabled={Boolean(busy)}
              onClick={() => void handleRemove()}
            >
              {busy ?? "Remove Member"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function JoinRequestsPanel({
  groupId,
  compact = false,
}: {
  groupId: number;
  compact?: boolean;
}) {
  const state = usePendingJoinRequests(groupId);
  const count = state.data?.length ?? 0;
  return (
    <section
      id="join-requests"
      className={`group-panel${compact ? " group-join-requests-compact" : ""}`}
      aria-labelledby="requests-heading"
    >
      <div className="group-join-requests-summary">
        <span className="group-join-requests-icon" aria-hidden="true">
          <AppIcon name="groups" width={19} height={19} />
        </span>
        <div className="group-join-requests-copy">
          <h2 id="requests-heading">Join Requests</h2>
          <p>Review people who want to join your community.</p>
        </div>
        <div className="group-join-requests-count">
          {state.loading ? "Loading…" : `${count} pending`}
        </div>
      </div>
      {state.error && (
        <GroupLoadError error={state.error} retry={state.refresh} />
      )}
      <ul className="group-attempt-list">
        {state.data?.map((request) => (
          <li key={request.id} className="group-attempt-row">
            <div className="group-person">
              <UserAvatar
                username={request.username}
                size="sm"
                alt=""
                className="group-member-avatar"
              />
              <span>@{request.username}</span>
            </div>
            <JoinRequestActions groupId={groupId} entityId={request.id} />
          </li>
        ))}
      </ul>
      {!state.loading && !state.error && state.data?.length === 0 && (
        <p className="group-join-requests-empty">
          No pending join requests.
        </p>
      )}
    </section>
  );
}

export function InvitationsPanel() {
  const state = usePendingInvitations();
  if (!state.loading && !state.error && !state.data?.length) return null;
  return (
    <section
      id="invitations"
      className="group-panel"
      aria-labelledby="invitations-heading"
    >
      <div className="group-section-heading">
        <h2 id="invitations-heading">
          Invitations{state.data && ` · ${state.data.length}`}
        </h2>
        {state.loading && <span className="group-muted">Loading…</span>}
      </div>
      {state.error && (
        <GroupLoadError error={state.error} retry={state.refresh} />
      )}
      <ul className="group-attempt-list">
        {state.data?.map((invitation) => (
          <li key={invitation.id} className="group-attempt-row">
            <div>
              {invitation.groupPrivacy === "public" ? (
                <Link
                  className="group-title-link"
                  href={`/groups/${invitation.groupId}#invitations`}
                >
                  {invitation.groupTitle}
                </Link>
              ) : (
                <span className="group-title-link">
                  {invitation.groupTitle}
                </span>
              )}
              <GroupPrivacyBadge privacy={invitation.groupPrivacy} />
              <p className="group-muted">
                Invited by @{invitation.inviterUsername}
              </p>
            </div>
            <InvitationActions
              groupId={invitation.groupId}
              entityId={invitation.id}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NonMemberActions({
  groupId,
  privacy,
  pending,
}: {
  groupId: number;
  privacy: GroupPrivacy;
  pending: boolean;
}) {
  const invitations = usePendingInvitations();
  const invitation = invitations.data?.find((i) => i.groupId === groupId);

  if (invitations.loading)
    return <p className="group-muted">Checking invitations…</p>;
  if (invitations.error)
    return (
      <GroupLoadError error={invitations.error} retry={invitations.refresh} />
    );
  if (invitation)
    return (
      <div className="group-membership-invitation">
        <MembershipBadge invited />
        <p className="group-muted">
          @{invitation.inviterUsername} invited you to join this group.
        </p>
        <InvitationActions groupId={groupId} entityId={invitation.id} />
      </div>
    );

  if (privacy === "private") {
    return (
      <p className="group-muted">
        This group is invite only. Only the group creator can invite new members.
      </p>
    );
  }

  return (
    <>
      <p className="group-muted">
        {pending
          ? "Your request is with the group creator. Check back for their response."
          : "Request access to this group’s posts, events, and chat. The creator must approve your membership."}
      </p>
      <GroupJoinButton
        groupId={groupId}
        privacy={privacy}
        pending={pending}
      />
    </>
  );
}
