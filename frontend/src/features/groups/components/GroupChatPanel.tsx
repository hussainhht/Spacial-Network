"use client";

import Link from "next/link";
import Image from "next/image";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import chatStyles from "@/features/chat/components/Chat.module.css";
import {
  formatMessageTime,
  getDisplayName,
  getInitials,
  parseDate,
} from "@/lib/utils";
import { avatarUrl } from "../api/groups";
import { useGroupChat } from "../hooks/useGroupChat";
import type { Group, GroupMember } from "../types/group";
import GroupAvatar from "./GroupAvatar";
import styles from "./GroupChatPanel.module.css";
import PostSharePreview from "@/features/interactions/components/PostSharePreview";
import { parseSharedPost } from "@/features/interactions/utils/sharedPost";

const MAX_MESSAGE_LENGTH = 2000;
const NEAR_LIMIT_THRESHOLD = 1800;

interface Props {
  group: Group;
  members: GroupMember[];
  membersLoading: boolean;
  isMember: boolean;
  onViewMembers: () => void;
}

function dateLabel(value?: string): string {
  const date = parseDate(value);
  if (!date) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

function startsNewDay(current?: string, previous?: string): boolean {
  const a = parseDate(current);
  const b = parseDate(previous);
  return !a || !b || a.toDateString() !== b.toDateString();
}

export default function GroupChatPanel({
  group,
  members,
  membersLoading,
  isMember,
  onViewMembers,
}: Props) {
  const chat = useGroupChat(group.id, isMember);
  const [inputText, setInputText] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCount = inputText.length;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;
  const isNearLimit = charCount >= NEAR_LIMIT_THRESHOLD;
  const count = members.length || group.memberCount;
  const onlineMembers = members.filter((member) =>
    chat.onlineUserIDs.includes(member.userId),
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [chat.messages.length]);

  const resizeComposer = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 40), 120)}px`;
  }, []);

  function submitMessage(event: React.FormEvent) {
    event.preventDefault();
    const content = inputText.trim();
    if (!content || isOverLimit || !isMember) return;
    chat.sendGroupMessage(content);
    setInputText("");
    if (textareaRef.current) textareaRef.current.style.height = "40px";
  }

  if (!isMember) {
    return (
      <section className={`${chatStyles.floatingCard} ${styles.restricted}`}>
        <span className={styles.restrictedIcon} aria-hidden="true">
          🔒
        </span>
        <h2>Group chat is member-only</h2>
        <p>Join this group to view its conversation and message members.</p>
      </section>
    );
  }

  return (
    <div className={styles.layout}>
      <section
        className={`${chatStyles.floatingCard} ${styles.conversation}`}
        aria-label={`${group.title} group chat`}
      >
        <header className={`${chatStyles.windowHeader} ${styles.header}`}>
          <div className={styles.headerIdentity}>
            <GroupAvatar
              group={group}
              size={44}
              className={styles.groupAvatar}
            />
            <div className={styles.headerCopy}>
              <h2>{group.title}</h2>
              <p>
                Group chat · {count} {count === 1 ? "member" : "members"}
              </p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <span
              className={`${styles.connection} ${chat.isConnected ? styles.connected : styles.reconnecting}`}
              role="status"
            >
              <span className={styles.connectionDot} />
              {chat.isConnected ? "Connected" : "Reconnecting"}
            </span>
            <button
              type="button"
              className={styles.detailsButton}
              onClick={() => setShowDetails(true)}
              aria-label="Show group chat details"
            >
              Members
            </button>
          </div>
        </header>

        {chat.error && (
          <div className={styles.errorBanner} role="alert">
            {chat.error}
          </div>
        )}

        <div
          className={`${chatStyles.messagesContainer} ${styles.messages}`}
          aria-live="polite"
          aria-busy={chat.loading}
        >
          {chat.hasMore && (
            <button
              type="button"
              onClick={chat.loadMoreHistory}
              disabled={chat.loadingMore}
              className={chatStyles.loadMoreBtn}
            >
              {chat.loadingMore
                ? "Loading older messages…"
                : "↑ Load older messages"}
            </button>
          )}
          {chat.loading && (
            <div className={styles.state} role="status">
              <span className={styles.spinner} />
              Loading chat history…
            </div>
          )}
          {!chat.loading && chat.messages.length === 0 && (
            <div className={styles.emptyState}>
              <h3>Group conversation</h3>
              <p>No messages yet.</p>
              <span>Start the conversation with the group.</span>
            </div>
          )}
          {!chat.loading &&
            chat.messages.map((message, index) => {
              const isMine =
                chat.myUserId !== null && message.user_id === chat.myUserId;
              const name = isMine
                ? "Me"
                : getDisplayName(
                    message.first_name ?? "",
                    message.last_name ?? "",
                    message.username ?? "",
                  );
              const image = avatarUrl(message.avatar);
              const showDate =
                index === 0 ||
                startsNewDay(
                  message.created_at,
                  chat.messages[index - 1]?.created_at,
                );
              const previousMessage = chat.messages[index - 1];
              const showSender =
                !isMine &&
                (showDate ||
                  !previousMessage ||
                  previousMessage.user_id !== message.user_id);
              return (
                <Fragment
                  key={
                    message.id ??
                    `${message.user_id}-${message.created_at}-${index}`
                  }
                >
                  {showDate && (
                    <div className={chatStyles.dateDivider}>
                      <span className={chatStyles.dateDividerText}>
                        {dateLabel(message.created_at)}
                      </span>
                    </div>
                  )}
                  <div
                    className={`${styles.messageRow} ${isMine ? styles.messageRowMine : ""}`}
                  >
                    {!isMine &&
                      (showSender ? (
                        image ? (
                          <Image
                            unoptimized
                            src={image}
                            alt=""
                            width={30}
                            height={30}
                            className={styles.senderAvatar}
                          />
                        ) : (
                          <span
                            className={styles.senderFallback}
                            aria-hidden="true"
                          >
                            {getInitials(
                              message.first_name ?? "",
                              message.last_name ?? "",
                              message.username ?? "",
                            )}
                          </span>
                        )
                      ) : (
                        <span
                          className={styles.senderSpacer}
                          aria-hidden="true"
                        />
                      ))}
                    <div className={styles.messageStack}>
                      {(isMine || showSender) && (
                        <div
                          className={`${styles.senderName} ${isMine ? styles.senderNameMine : ""}`}
                        >
                          {isMine ? (
                            name
                          ) : (
                            <Link href={`/profile/${message.username}`}>
                              {name}
                            </Link>
                          )}
                        </div>
                      )}
                      <div
                        className={
                          isMine
                            ? chatStyles.bubbleMine
                            : chatStyles.bubblePartner
                        }
                      >
                        {(() => {
                          const shared = parseSharedPost(message.content);
                          if (!shared)
                            return (
                              <div className={chatStyles.messageContent}>
                                {message.content}
                              </div>
                            );
                          return (
                            <>
                              {shared.note && (
                                <div className={chatStyles.messageContent}>
                                  {shared.note}
                                </div>
                              )}
                              <PostSharePreview postId={shared.postId} />
                            </>
                          );
                        })()}
                        <div
                          className={`${chatStyles.bubbleMeta} ${isMine ? chatStyles.bubbleMetaMine : chatStyles.bubbleMetaPartner}`}
                        >
                          <time className={chatStyles.bubbleTime}>
                            {formatMessageTime(message.created_at)}
                          </time>
                        </div>
                      </div>
                    </div>
                  </div>
                </Fragment>
              );
            })}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={submitMessage} className={chatStyles.composer}>
          <div className={chatStyles.composerInputWrapper}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              maxLength={MAX_MESSAGE_LENGTH + 1}
              placeholder="Message the group…"
              className={chatStyles.composerTextarea}
              onChange={(event) => {
                setInputText(event.target.value);
                resizeComposer();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitMessage(event);
                }
              }}
            />
            <span
              className={`${chatStyles.charCounter} ${isOverLimit ? chatStyles.charCounterOver : isNearLimit ? chatStyles.charCounterNear : ""}`}
              aria-live="polite"
            >
              {isOverLimit
                ? `-${charCount - MAX_MESSAGE_LENGTH}`
                : `${charCount}/${MAX_MESSAGE_LENGTH}`}
            </span>
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() || isOverLimit}
            className={chatStyles.sendButton}
            aria-label="Send message"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </section>

      <aside
        className={`${chatStyles.floatingCard} ${styles.sidebar} ${showDetails ? styles.sidebarOpen : ""}`}
        aria-label="Group chat details"
      >
        <button
          type="button"
          className={styles.closeDetails}
          onClick={() => setShowDetails(false)}
          aria-label="Close group chat details"
        >
          ×
        </button>
        <div className={styles.sidebarIntro}>
          <GroupAvatar
            group={group}
            size={58}
            className={styles.sidebarAvatar}
          />
          <div>
            <h2>{group.title}</h2>
            <p>
              {count} {count === 1 ? "member" : "members"}
            </p>
          </div>
        </div>
        <div className={styles.memberHeading}>
          <div>
            <h3>Members</h3>
            {onlineMembers.length > 0 && (
              <span>{onlineMembers.length} online</span>
            )}
          </div>
          <button type="button" onClick={onViewMembers}>
            View all
          </button>
        </div>
        <div className={styles.memberList}>
          {membersLoading && (
            <p className={styles.memberState}>Loading members…</p>
          )}
          {!membersLoading && members.length === 0 && (
            <p className={styles.memberState}>No members to show.</p>
          )}
          {members.map((member) => {
            const image = avatarUrl(member.avatar);
            const online = chat.onlineUserIDs.includes(member.userId);
            return (
              <Link
                href={`/profile/${member.username}`}
                className={styles.member}
                key={member.userId}
              >
                <span className={styles.memberAvatarWrap}>
                  {image ? (
                    <Image
                      unoptimized
                      src={image}
                      alt=""
                      width={34}
                      height={34}
                    />
                  ) : (
                    <span>{getInitials("", "", member.username)}</span>
                  )}
                  {online && <i title="Online" />}
                </span>
                <span className={styles.memberCopy}>
                  <strong>{member.username}</strong>
                  <small>
                    {member.role === "creator"
                      ? "Group creator"
                      : online
                        ? "Online"
                        : "Member"}
                  </small>
                </span>
              </Link>
            );
          })}
        </div>
      </aside>
      {showDetails && (
        <button
          type="button"
          className={styles.backdrop}
          onClick={() => setShowDetails(false)}
          aria-label="Close group chat details"
        />
      )}
    </div>
  );
}
