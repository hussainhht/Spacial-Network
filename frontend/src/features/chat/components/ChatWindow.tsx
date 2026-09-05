"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatWindowProps } from "../types/chat";
import { formatMessageDateTime, getInitials } from "@/lib/utils";

export default function ChatWindow({
  partnerId,
  partnerUsername,
  partnerAvatar,
  isPartnerOnline,
  isPartnerTyping,
  myUserId,
  messages,
  loadingHistory,
  hasMoreHistory,
  onLoadMore,
  onSendMessage,
  onTyping,
}: ChatWindowProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPartnerTyping]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputText(e.target.value);

    onTyping(true);

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      onTyping(false);
    }, 1500);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage(inputText.trim());
    setInputText("");

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    onTyping(false);
  }

  const initials = getInitials("", "", partnerUsername);

  return (
    <div style={styles.chatContainer}>
      <header style={styles.header}>
        <div style={styles.headerProfile}>
          <div style={styles.avatarWrapper}>
            {partnerAvatar ? (
              <img
                src={partnerAvatar}
                alt={partnerUsername}
                style={styles.avatarImg}
              />
            ) : (
              <div style={styles.avatarPlaceholder}>{initials}</div>
            )}
            <span
              style={{
                ...styles.statusDot,
                background: isPartnerOnline ? "#22c55e" : "#94a3b8",
              }}
              title={isPartnerOnline ? "Online" : "Offline"}
            />
          </div>

          <div>
            <h3 style={styles.headerUsername}>{partnerUsername}</h3>
            <span style={styles.headerStatusText}>
              {isPartnerTyping ? (
                <span style={styles.typingIndicator}>✍️ typing...</span>
              ) : isPartnerOnline ? (
                <span style={{ color: "#22c55e" }}>Online</span>
              ) : (
                <span style={{ color: "#94a3b8" }}>Offline</span>
              )}
            </span>
          </div>
        </div>
      </header>

      <div style={styles.messageList}>
        {hasMoreHistory && (
          <div style={styles.loadMoreWrapper}>
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingHistory}
              style={styles.loadMoreBtn}
            >
              {loadingHistory ? "Loading older messages..." : "↑ Load older messages"}
            </button>
          </div>
        )}

        {messages.length === 0 && !loadingHistory && (
          <div style={styles.emptyMessages}>
            <p>No messages with {partnerUsername} yet.</p>
            <p style={styles.emptySubtext}>Say hello to start the conversation!</p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isMine = myUserId !== null && msg.sender_id === myUserId;
          const isRead = Boolean(msg.read_at);

          return (
            <div
              key={msg.id || index}
              style={{
                ...styles.messageRow,
                justifyContent: isMine ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  ...styles.bubble,
                  ...(isMine ? styles.myBubble : styles.partnerBubble),
                }}
              >
                <div style={styles.messageContent}>{msg.content}</div>

                <div
                  style={{
                    ...styles.messageMeta,
                    justifyContent: isMine ? "flex-end" : "flex-start",
                  }}
                >
                  <time style={styles.timestamp}>
                    {formatMessageDateTime(msg.created_at)}
                  </time>
                  {isMine && (
                    <span
                      style={{
                        ...styles.readStatus,
                        color: isRead ? "#60a5fa" : "#94a3b8",
                      }}
                      title={isRead ? `Seen at ${msg.read_at}` : "Delivered"}
                    >
                      {isRead ? "✓✓" : "✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isPartnerTyping && (
          <div style={{ ...styles.messageRow, justifyContent: "flex-start" }}>
            <div style={{ ...styles.bubble, ...styles.partnerBubble, opacity: 0.85 }}>
              <span style={{ fontStyle: "italic", fontSize: "0.85rem", color: "#cbd5e1" }}>
                {partnerUsername} is typing...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} style={styles.footerForm}>
        <input
          type="text"
          placeholder={`Message ${partnerUsername}...`}
          value={inputText}
          onChange={handleInputChange}
          style={styles.inputField}
          autoFocus
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          style={{
            ...styles.sendButton,
            opacity: inputText.trim() ? 1 : 0.6,
            cursor: inputText.trim() ? "pointer" : "not-allowed",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}


const styles: Record<string, React.CSSProperties> = {
  chatContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "rgba(8, 11, 26, 0.95)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.9rem 1.5rem",
    borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
    background: "rgba(11, 16, 38, 0.8)",
  },
  headerProfile: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  avatarWrapper: {
    position: "relative",
    width: "40px",
    height: "40px",
  },
  avatarImg: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    objectFit: "cover",
  },
  avatarPlaceholder: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6366f1, #3b82f6)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: "0.85rem",
  },
  statusDot: {
    position: "absolute",
    bottom: "0px",
    right: "0px",
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    border: "2px solid #080b1a",
  },
  headerUsername: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 600,
    color: "#f8fafc",
  },
  headerStatusText: {
    fontSize: "0.75rem",
  },
  typingIndicator: {
    color: "#818cf8",
    fontStyle: "italic",
  },
  messageList: {
    flex: 1,
    overflowY: "auto",
    padding: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  loadMoreWrapper: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "0.5rem",
  },
  loadMoreBtn: {
    background: "rgba(30, 41, 59, 0.6)",
    color: "#cbd5e1",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    padding: "6px 14px",
    borderRadius: "20px",
    fontSize: "0.78rem",
    cursor: "pointer",
  },
  emptyMessages: {
    margin: "auto",
    textAlign: "center",
    color: "#94a3b8",
  },
  emptySubtext: {
    fontSize: "0.85rem",
    color: "#64748b",
  },
  messageRow: {
    display: "flex",
    width: "100%",
  },
  bubble: {
    maxWidth: "68%",
    padding: "10px 14px",
    borderRadius: "14px",
    wordBreak: "break-word",
    lineHeight: 1.45,
  },
  myBubble: {
    background: "linear-gradient(135deg, #4f46e5, #3b82f6)",
    color: "#ffffff",
    borderBottomRightRadius: "3px",
  },
  partnerBubble: {
    background: "#1e293b",
    color: "#f1f5f9",
    borderBottomLeftRadius: "3px",
    border: "1px solid rgba(148, 163, 184, 0.12)",
  },
  messageContent: {
    fontSize: "0.92rem",
    whiteSpace: "pre-wrap",
  },
  messageMeta: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginTop: "4px",
  },
  timestamp: {
    fontSize: "0.7rem",
    opacity: 0.75,
  },
  readStatus: {
    fontSize: "0.75rem",
    fontWeight: 700,
    marginLeft: "2px",
  },
  footerForm: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "1rem 1.5rem",
    borderTop: "1px solid rgba(148, 163, 184, 0.15)",
    background: "rgba(11, 16, 38, 0.9)",
  },
  inputField: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: "24px",
    border: "1px solid rgba(148, 163, 184, 0.25)",
    background: "rgba(16, 21, 47, 0.8)",
    color: "#f8fafc",
    fontSize: "0.92rem",
    outline: "none",
  },
  sendButton: {
    padding: "10px 22px",
    borderRadius: "24px",
    border: "none",
    background: "#4f46e5",
    color: "#ffffff",
    fontWeight: 600,
    fontSize: "0.9rem",
    transition: "opacity 0.2s ease",
  },
};
