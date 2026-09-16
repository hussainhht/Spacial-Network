"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import type { ChatWindowProps } from "../types/chat";
import PostSharePreview from "@/features/interactions/components/PostSharePreview";
import { parseSharedPost } from "@/features/interactions/utils/sharedPost";
import { formatMessageTime, parseDate } from "@/lib/utils";
import styles from "./Chat.module.css";

const MAX_MESSAGE_LENGTH = 2000;
const NEAR_LIMIT_THRESHOLD = 1800;

function isDifferentDay(dateStr1?: string, dateStr2?: string): boolean {
  if (!dateStr1 || !dateStr2) return true;
  const d1 = parseDate(dateStr1);
  const d2 = parseDate(dateStr2);
  if (!d1 || !d2) return true;
  return (
    d1.getFullYear() !== d2.getFullYear() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getDate() !== d2.getDate()
  );
}

function formatDateDivider(dateStr?: string): string {
  const d = parseDate(dateStr);
  if (!d) return "";
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ChatWindow({
  partnerUsername,
  partnerAvatar,
  isPartnerOnline,
  isPartnerTyping,
  isEligible = true,
  myUserId,
  messages,
  loadingHistory,
  hasMoreHistory,
  onLoadMore,
  onSendMessage,
  onTyping,
  onBack,
}: ChatWindowProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const charCount = inputText.length;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;
  const isNearLimit = charCount >= NEAR_LIMIT_THRESHOLD;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [messages, isPartnerTyping]);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, 40), 120);
    textarea.style.height = `${nextHeight}px`;
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputText(e.target.value);
    adjustTextareaHeight();

    onTyping(true);

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      onTyping(false);
    }, 1500);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || isOverLimit) return;

    onSendMessage(inputText.trim());
    setInputText("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    onTyping(false);
  }

  return (
    <section className={`${styles.floatingCard} ${styles.chatWindowCard}`}>
      <header className={styles.windowHeader}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            onClick={() => onBack?.()}
            className={styles.backButton}
            aria-label="Back to conversations"
            title="Back to conversations"
          >
            ←
          </button>

          <Link
            href={`/profile/${partnerUsername}`}
            className={styles.profileHeaderLink}
            title={`View ${partnerUsername}'s profile`}
            aria-label={`View ${partnerUsername}'s profile`}
          >
            <div className={styles.avatarWrapper}>
              <UserAvatar
                src={partnerAvatar}
                username={partnerUsername}
                size={44}
                alt={partnerUsername}
                className={styles.avatarImg}
              />
              <span
                className={
                  isPartnerOnline ? styles.onlineRing : styles.offlineDot
                }
                title={isPartnerOnline ? "Online" : "Offline"}
              />
            </div>

            <div className={styles.headerProfile}>
              <h3 className={styles.partnerName}>{partnerUsername}</h3>
              <div className={styles.partnerStatus}>
                {isPartnerTyping ? (
                  <span className={styles.typingIndicatorText}>
                    typing
                    <span className={styles.typingDotsInline}>
                      <span className={styles.typingDot} />
                      <span className={styles.typingDot} />
                      <span className={styles.typingDot} />
                    </span>
                  </span>
                ) : isPartnerOnline ? (
                  <span className={styles.statusOnline}>Online now</span>
                ) : (
                  <span>Offline</span>
                )}
              </div>
            </div>
          </Link>
        </div>
      </header>

      <div className={styles.messagesContainer}>
        {hasMoreHistory && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingHistory}
            className={styles.loadMoreBtn}
          >
            {loadingHistory
              ? "Loading older messages..."
              : "↑ Load older messages"}
          </button>
        )}

        {messages.length === 0 && !loadingHistory && (
          <div className={styles.emptyNotice}>
            <p>No messages with {partnerUsername} yet.</p>
            <p style={{ marginTop: "4px", fontSize: "12px", opacity: 0.8 }}>
              Say hello to start the conversation!
            </p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isMine = myUserId !== null && msg.sender_id === myUserId;
          const isRead = Boolean(msg.read_at);
          const previousMessage = messages[index - 1];
          const showDateDivider =
            index === 0 ||
            isDifferentDay(previousMessage?.created_at, msg.created_at);
          const showPartnerAvatar =
            !isMine &&
            (index === 0 ||
              previousMessage?.sender_id !== msg.sender_id ||
              isDifferentDay(previousMessage?.created_at, msg.created_at));

          return (
            <Fragment key={msg.id || index}>
              {showDateDivider && (
                <div className={styles.dateDivider}>
                  <span className={styles.dateDividerText}>
                    {formatDateDivider(msg.created_at)}
                  </span>
                </div>
              )}

              <div
                className={
                  isMine ? styles.messageRowMine : styles.messageRowPartner
                }
              >
                {!isMine &&
                  (showPartnerAvatar ? (
                    <UserAvatar
                      src={msg.sender_avatar}
                      firstName={msg.sender_first_name}
                      lastName={msg.sender_last_name}
                      username={msg.sender_username || partnerUsername}
                      size="xs"
                      alt=""
                      className={styles.messageAvatar}
                    />
                  ) : (
                    <span className={styles.messageAvatarSpacer} aria-hidden="true" />
                  ))}
                <div
                  className={isMine ? styles.bubbleMine : styles.bubblePartner}
                >
                  {(() => {
                    const shared = parseSharedPost(msg.content);
                    if (!shared) {
                      return (
                        <div className={styles.messageContent}>
                          {msg.content}
                        </div>
                      );
                    }
                    return (
                      <>
                        {shared.note && (
                          <div className={styles.messageContent}>
                            {shared.note}
                          </div>
                        )}
                        <PostSharePreview postId={shared.postId} />
                      </>
                    );
                  })()}

                  <div
                    className={`${styles.bubbleMeta} ${
                      isMine ? styles.bubbleMetaMine : styles.bubbleMetaPartner
                    }`}
                  >
                    <time className={styles.bubbleTime}>
                      {formatMessageTime(msg.created_at)}
                    </time>
                    {isMine && (
                      <span
                        className={`${styles.readReceipt} ${
                          isRead ? styles.receiptSeen : styles.receiptDelivered
                        }`}
                        title={isRead ? `Seen at ${msg.read_at}` : "Delivered"}
                      >
                        {isRead ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}

        {isPartnerTyping && (
          <div className={styles.messageRowPartner}>
            <div
              className={styles.typingWaveBubble}
              aria-label={`${partnerUsername} is typing`}
            >
              <span className={styles.waveDot} />
              <span className={styles.waveDot} />
              <span className={styles.waveDot} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {!isEligible ? (
        <div className={styles.ineligibleBanner}>
          <div className={styles.ineligibleText}>
            <span>🔒 Mutual follow required to exchange direct messages.</span>
          </div>
          <Link
            href={`/profile/${partnerUsername}`}
            className={styles.followBtn}
          >
            Follow @{partnerUsername}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.composer}>
          <div className={styles.composerInputWrapper}>
            <textarea
              ref={textareaRef}
              rows={1}
              placeholder={`Message ${partnerUsername}...`}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className={styles.composerTextarea}
            />
            <span
              className={`${styles.charCounter} ${
                isOverLimit
                  ? styles.charCounterOver
                  : isNearLimit
                    ? styles.charCounterNear
                    : ""
              }`}
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
            className={styles.sendButton}
            aria-label="Send message"
            title="Send message"
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
      )}
    </section>
  );
}
