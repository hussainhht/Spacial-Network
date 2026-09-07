"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useState } from "react";
import { getInitials } from "@/lib/utils";
import { avatarUrl } from "../api/groups";
import {
  useGroupMembers,
  useMembership,
  usePendingInvitations,
  usePendingJoinRequests,
} from "../hooks/useGroupData";
import GroupInviteModal from "./GroupInviteModal";
import GroupJoinButton from "./GroupJoinButton";
import { InvitationActions, JoinRequestActions } from "./GroupResponseActions";

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
  groupId,
  creatorId,
}: {
  groupId: number;
  creatorId: number;
}) {
  const state = useGroupMembers(groupId);
  // Shares the same cached resource as MembershipPanel's useMembership call,
  // so this does not trigger a second membership request.
  const membership = useMembership(groupId);
  const isCreator = membership.data?.role === "creator";
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const closeInviteModal = useCallback(() => setIsInviteModalOpen(false), []);

  return (
    <aside
      className="group-panel group-members"
      aria-labelledby="members-heading"
    >
      <div className="group-section-heading">
        <h2 id="members-heading">
          Members{state.data && ` · ${state.data.length}`}
        </h2>
        <div className="group-members-header-actions">
          {state.loading && <span className="group-muted">Loading…</span>}
          {isCreator && (
            <button
              type="button"
              className="group-button secondary"
              onClick={() => setIsInviteModalOpen(true)}
            >
              + Invite
            </button>
          )}
        </div>
      </div>
      {state.error && (
        <GroupLoadError error={state.error} retry={state.refresh} />
      )}
      {state.data && (
        <ul
          className="group-members-list"
          tabIndex={0}
          aria-label="Group members"
        >
          {state.data.map((member) => (
            <li key={member.userId} className="group-member-item">
              {member.avatar ? (
                <Image
                  unoptimized
                  src={avatarUrl(member.avatar)!}
                  alt=""
                  width={36}
                  height={36}
                  className="group-member-avatar"
                />
              ) : (
                <span
                  className="group-member-avatar fallback"
                  aria-hidden="true"
                >
                  {getInitials("", "", member.username)}
                </span>
              )}
              <Link
                className="group-member-name"
                href={`/profile/${encodeURIComponent(member.username)}`}
              >
                @{member.username}
              </Link>
              {member.userId === creatorId && (
                <span className="group-member-role">Creator</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!state.loading && state.data?.length === 0 && (
        <p className="group-muted">No members to display.</p>
      )}
      <GroupInviteModal
        groupId={groupId}
        open={isInviteModalOpen}
        onClose={closeInviteModal}
      />
    </aside>
  );
}

export function JoinRequestsPanel({ groupId }: { groupId: number }) {
  const state = usePendingJoinRequests(groupId);
  return (
    <section
      id="join-requests"
      className="group-panel"
      aria-labelledby="requests-heading"
    >
      <div className="group-section-heading">
        <h2 id="requests-heading">
          Join Requests{state.data && ` · ${state.data.length}`}
        </h2>
        {state.loading && <span className="group-muted">Loading…</span>}
      </div>
      <p className="group-muted">
        Review people who would like to join your community.
      </p>
      {state.error && (
        <GroupLoadError error={state.error} retry={state.refresh} />
      )}
      {!state.loading && !state.error && state.data?.length === 0 && (
        <p className="group-empty">
          You’re all caught up. New requests will appear here.
        </p>
      )}
      <ul className="group-attempt-list">
        {state.data?.map((request) => (
          <li key={request.id} className="group-attempt-row">
            <div className="group-person">
              <span className="group-member-avatar fallback" aria-hidden="true">
                {getInitials("", "", request.username)}
              </span>
              <span>@{request.username}</span>
            </div>
            <JoinRequestActions groupId={groupId} entityId={request.id} />
          </li>
        ))}
      </ul>
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
              <Link
                className="group-title-link"
                href={`/groups/${invitation.groupId}#invitations`}
              >
                {invitation.groupTitle}
              </Link>
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

export function MembershipPanel({ groupId }: { groupId: number }) {
  const membership = useMembership(groupId);
  return (
    <>
      <section
        id="invitations"
        className="group-panel"
        aria-labelledby="membership-heading"
      >
        <div className="group-section-heading">
          <h2 id="membership-heading">Your membership</h2>
        </div>
        {membership.loading && (
          <p className="group-muted">Checking membership…</p>
        )}
        {membership.error && (
          <GroupLoadError error={membership.error} retry={membership.refresh} />
        )}
        {!membership.loading &&
          !membership.error &&
          membership.data &&
          (membership.data.isMember ? (
            <>
              <MembershipBadge role={membership.data.role} />
              <p className="group-muted">
                {membership.data.role === "creator"
                  ? "Manage requests and invite people to grow your community."
                  : "You’re part of this community. Invite someone to join you."}
              </p>
            </>
          ) : (
            <NonMemberActions
              groupId={groupId}
              pending={membership.data.hasPendingJoinRequest}
            />
          ))}
      </section>
      {!membership.error &&
        membership.data?.isMember &&
        membership.data.role === "creator" && (
          <JoinRequestsPanel groupId={groupId} />
        )}
    </>
  );
}

function NonMemberActions({
  groupId,
  pending,
}: {
  groupId: number;
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

  return (
    <>
      <p className="group-muted">
        {pending
          ? "Your request is with the group creator. Check back for their response."
          : "Send a request to the creator to become a member."}
      </p>
      <GroupJoinButton groupId={groupId} />
    </>
  );
}
