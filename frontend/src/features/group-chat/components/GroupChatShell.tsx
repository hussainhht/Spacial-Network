import type { useGroupChatController } from "../hooks/useGroupChatController";
import GroupChatComposer from "./GroupChatComposer";
import GroupChatErrorState from "./GroupChatErrorState";
import GroupChatHeader from "./GroupChatHeader";
import GroupChatInfoRail from "./GroupChatInfoRail";
import GroupChatInfoSheet from "./GroupChatInfoSheet";
import GroupChatTimeline from "./GroupChatTimeline";
import styles from "../group-chat.module.css";

interface GroupChatShellProps {
  controller: ReturnType<typeof useGroupChatController>;
  onViewMembers: () => void;
}

export default function GroupChatShell({
  controller,
  onViewMembers,
}: GroupChatShellProps) {
  return (
    <div
      className={styles.shell}
      aria-label={`${controller.group.title} community chat`}
    >
      <GroupChatHeader
        group={controller.group}
        totalMembersCount={controller.totalMembersCount}
        onlineCount={controller.onlineCount}
        connectionStatus={controller.connectionStatus}
        onOpenInfoSheet={controller.openInfoSheet}
      />

      {controller.error && (
        <GroupChatErrorState
          error={controller.error}
          onRetry={controller.retryInitialLoad}
        />
      )}

      <div className={styles.body}>
        <div className={styles.timelineColumn}>
          <GroupChatTimeline
            timelineRef={controller.timelineRef}
            items={controller.timelineItems}
            loading={controller.loading}
            loadingMore={controller.loadingMore}
            hasMore={controller.hasMore}
            isAtBottom={controller.isAtBottom}
            unreadCount={controller.unreadCount}
            onLoadMore={controller.loadMoreHistory}
            onJumpToLatest={() => controller.scrollToLatest(true)}
          />

          <GroupChatComposer
            inputText={controller.inputText}
            setInputText={controller.setInputText}
            charCount={controller.charCount}
            isOverLimit={controller.isOverLimit}
            isNearLimit={controller.isNearLimit}
            disabled={!controller.isMember}
            onSendMessage={controller.sendMessage}
          />
        </div>

        <GroupChatInfoRail
          group={controller.group}
          members={controller.membersList}
          searchQuery={controller.memberSearchQuery}
          onSearchChange={controller.setMemberSearchQuery}
          isUserOnline={controller.isUserOnline}
          onlineCount={controller.onlineCount}
          totalMembersCount={controller.totalMembersCount}
          loading={controller.membersLoading}
          onViewMembers={onViewMembers}
        />
      </div>

      <GroupChatInfoSheet
        isOpen={controller.isInfoSheetOpen}
        onClose={controller.closeInfoSheet}
        group={controller.group}
        members={controller.membersList}
        searchQuery={controller.memberSearchQuery}
        onSearchChange={controller.setMemberSearchQuery}
        isUserOnline={controller.isUserOnline}
        onlineCount={controller.onlineCount}
        totalMembersCount={controller.totalMembersCount}
        loading={controller.membersLoading}
        onViewMembers={onViewMembers}
      />
    </div>
  );
}
