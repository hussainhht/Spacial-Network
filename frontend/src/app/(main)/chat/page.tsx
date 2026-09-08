"use client";

import { useState } from "react";
import { useWebSocket } from "@/providers/WebSocketProvider";

export default function ChatPage() {
  const {
    isConnected,
    onlineUserIDs,
    lastMessage,
    typingStatus,
    errorMessage,
    sendEvent,
  } = useWebSocket();

  const [recipientID, setRecipientID] = useState("2");
  const [messageText, setMessageText] = useState("");

  function handleSendMessage() {
    if (!messageText.trim()) return;
    sendEvent("private_message", {
      recipient_id: parseInt(recipientID, 10),
      content: messageText.trim(),
    });
    setMessageText("");
  }

  function handleTyping(isTyping: boolean) {
    const rId = parseInt(recipientID, 10);
    if (!rId) return;
    sendEvent("typing", {
      recipient_id: rId,
      is_typing: isTyping,
    });
  }

  const cardStyle: React.CSSProperties = {
    marginBottom: "1.5rem",
    padding: "1.25rem",
    background: "rgba(13, 17, 38, 0.7)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    border: "1px solid rgba(148, 163, 184, 0.15)",
    borderRadius: "14px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.25)",
  };

  return (
    <main
      style={{
        padding: "clamp(1.5rem, 4vw, 3rem) 1rem",
        maxWidth: "860px",
        margin: "0 auto",
        color: "var(--space-text-body, #d8def0)",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
      }}
    >


      {/* 1. Connection Status */}
      <div style={cardStyle}>
        <h3
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1rem",
            color: "var(--space-text-heading, #f8fafc)",
          }}
        >
          Connection Status:{" "}
          <span style={{ color: isConnected ? "#4ade80" : "#f87171" }}>
            {isConnected
              ? "🟢 Connected to /api/ws"
              : "🔴 Disconnected (Log in first)"}
          </span>
        </h3>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem" }}>
          <a
            href="/login"
            style={{
              color: "var(--space-accent-indigo, #818cf8)",
              marginRight: "1rem",
              textDecoration: "underline",
            }}
          >
            Login
          </a>
          <a
            href="/register"
            style={{
              color: "var(--space-accent-indigo, #818cf8)",
              textDecoration: "underline",
            }}
          >
            Register
          </a>
        </p>
      </div>

      {/* Server Error Alert */}
      {errorMessage && (
        <div
          style={{
            padding: "12px 16px",
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            borderRadius: "10px",
            color: "#fca5a5",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
          }}
        >
          ⚠️ <strong>Notice:</strong> {errorMessage}
        </div>
      )}

      {/* 2. Online Users */}
      <div style={cardStyle}>
        <h3
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1rem",
            color: "var(--space-text-heading, #f8fafc)",
          }}
        >
          👥 Online User IDs:
        </h3>
        <p
          style={{
            margin: "0",
            fontWeight: 600,
            fontSize: "1.1rem",
            color: "#4ade80",
          }}
        >
          {onlineUserIDs.length > 0
            ? JSON.stringify(onlineUserIDs)
            : "[] (No active sessions)"}
        </p>
      </div>

      {/* 3. Send Message */}
      <div style={cardStyle}>
        <h3
          style={{
            margin: "0 0 0.75rem",
            fontSize: "1rem",
            color: "var(--space-text-heading, #f8fafc)",
          }}
        >
          ✉️ Send Message:
        </h3>
        <div style={{ marginBottom: "12px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "6px",
              fontSize: "0.85rem",
              color: "var(--space-text-muted, #94a3b8)",
            }}
          >
            Recipient User ID:
          </label>
          <input
            type="number"
            value={recipientID}
            onChange={(e) => setRecipientID(e.target.value)}
            style={{
              padding: "8px 12px",
              width: "140px",
              background: "rgba(10, 15, 35, 0.75)",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              borderRadius: "8px",
              color: "#f8fafc",
              fontSize: "0.95rem",
              outline: "none",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            placeholder="Type a message..."
            value={messageText}
            onChange={(e) => {
              setMessageText(e.target.value);
              handleTyping(e.target.value.length > 0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSendMessage();
                handleTyping(false);
              }
            }}
            style={{
              padding: "10px 14px",
              flex: 1,
              background: "rgba(10, 15, 35, 0.75)",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              borderRadius: "8px",
              color: "#f8fafc",
              fontSize: "0.95rem",
              outline: "none",
            }}
          />
          <button
            onClick={() => {
              handleSendMessage();
              handleTyping(false);
            }}
            style={{
              padding: "10px 22px",
              background:
                "linear-gradient(135deg, var(--space-accent-indigo, #6366f1), var(--space-accent-blue, #3b82f6))",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
              boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
            }}
          >
            Send
          </button>
        </div>
      </div>

      {/* 4. Live Received Events */}
      <div style={cardStyle}>
        <h3
          style={{
            margin: "0 0 0.75rem",
            fontSize: "1rem",
            color: "var(--space-text-heading, #f8fafc)",
          }}
        >
          📥 Latest Message Stream:
        </h3>
        <pre
          style={{
            background: "rgba(8, 12, 28, 0.85)",
            border: "1px solid rgba(148, 163, 184, 0.12)",
            color: "#e2e8f0",
            padding: "1rem",
            borderRadius: "8px",
            overflowX: "auto",
            fontSize: "0.85rem",
            lineHeight: 1.5,
          }}
        >
          {lastMessage
            ? JSON.stringify(lastMessage, null, 2)
            : "// No messages received yet"}
        </pre>

        {typingStatus?.is_typing && (
          <p
            style={{
              color: "var(--space-accent-indigo, #818cf8)",
              fontStyle: "italic",
              marginTop: "10px",
              fontSize: "0.875rem",
            }}
          >
            ✍️ User {typingStatus.sender_id} is typing...
          </p>
        )}
      </div>
    </main>
  );
}
