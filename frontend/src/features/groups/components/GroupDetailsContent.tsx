"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import AppIcon from "@/components/layout/AppIcon";
import {
  useGroup,
  useGroupMembers,
  useMembership,
  usePendingInvitations,
} from "../hooks/useGroupData";
import GroupHeaderCard from "./GroupHeaderCard";
import { GroupLoadError, MembershipBadge } from "./GroupPanels";
import GroupTabs, {
  getActiveGroupTab,
  getGroupTabHref,
  type ActiveGroupTab,
} from "./GroupTabs";
import type { Group } from "../types/group";

interface GroupPageContextValue {
  groupId: number;
  group: Group;
  members: ReturnType<typeof useGroupMembers>;
  membership: ReturnType<typeof useMembership>;
  isCreator: boolean;
  isMember: boolean;
  navigateToTab: (tab: ActiveGroupTab) => void;
}

const GroupPageContext = createContext<GroupPageContextValue | null>(null);

export function useGroupPageContext() {
  const context = useContext(GroupPageContext);
  if (!context) {
    throw new Error("useGroupPageContext must be used inside GroupDetailsContent");
  }
  return context;
}

export default function GroupDetailsContent({
  children,
}: {
  children: ReactNode;
}) {
  const { groupId } = useParams<{ groupId: string }>();
  const id = Number(groupId);

  if (!/^[1-9]\d*$/.test(groupId) || !Number.isSafeInteger(id))
    return (
      <div className="group-details-container">
        <Link href="/groups" className="back-link">
          <AppIcon name="arrowLeft" width={16} height={16} /> Back to groups
        </Link>
        <p className="form-error" role="alert">
          Invalid group ID. Choose a group from the directory.
        </p>
      </div>
    );

  return (
    <GroupDetails key={id} groupId={id}>
      {children}
    </GroupDetails>
  );
}

function GroupDetails({
  children,
  groupId,
}: {
  children: ReactNode;
  groupId: number;
}) {
  // Independent subscriptions start these three requests concurrently.
  const group = useGroup(groupId);
  const members = useGroupMembers(groupId);
  const membership = useMembership(groupId);
  const invitations = usePendingInvitations();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = getActiveGroupTab(pathname, groupId);
  const navigateToTab = useCallback(
    (tab: ActiveGroupTab) => router.push(getGroupTabHref(groupId, tab)),
    [groupId, router],
  );
  const isCreator = membership.data?.role === "creator";
  const isMember = Boolean(membership.data?.isMember);
  const memberCount = members.data?.length ?? group.data?.memberCount ?? 0;

  const membershipStatus = (
    <>
      {!membership.loading &&
        !membership.error &&
        membership.data &&
        (membership.data.isMember ||
          (!invitations.loading && !invitations.error)) && (
          <MembershipBadge
            role={membership.data.isMember ? membership.data.role : undefined}
            pending={membership.data.hasPendingJoinRequest}
            invited={invitations.data?.some((i) => i.groupId === groupId)}
          />
        )}
      {membership.loading && (
        <span className="group-muted-inline">Checking membership…</span>
      )}
    </>
  );

  return (
    <div className="group-details-container">
      <Link href="/groups" className="back-link">
        <AppIcon name="arrowLeft" width={16} height={16} /> Back to groups
      </Link>
      {group.loading && !group.data && (
        <div className="group-panel group-loading" role="status">
          Loading community…
        </div>
      )}
      {group.error && (
        <GroupLoadError error={group.error} retry={group.refresh} />
      )}
      {group.data && (
        <GroupPageContext.Provider
          value={{
            groupId,
            group: group.data,
            members,
            membership,
            isCreator,
            isMember,
            navigateToTab,
          }}
        >
          {activeTab !== "chat" && (
            <GroupHeaderCard
              group={group.data}
              memberCount={memberCount}
              isCreator={isCreator}
              membershipStatus={membershipStatus}
              onEdit={() => navigateToTab("settings")}
            />
          )}
          <GroupTabs
            activeTab={activeTab}
            onTabChange={navigateToTab}
            canEdit={isCreator}
          />
          {children}
        </GroupPageContext.Provider>
      )}
    </div>
  );
}
