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

  return (
    <main
      style={{
        padding: "2rem",
        fontFamily: "sans-serif",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      <h1>💬 Real-Time Chat</h1>

      {/* 1. Connection Status */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h3>
          Connection Status:{" "}
          <span style={{ color: isConnected ? "#16a34a" : "#dc2626" }}>
            {isConnected
              ? "🟢 Connected to /api/ws"
              : "🔴 Disconnected (Log in first)"}
          </span>
        </h3>
        <p>
          <a href="/login" style={{ color: "#2563eb", marginRight: "1rem" }}>
            Login
          </a>
          <a href="/register" style={{ color: "#2563eb" }}>
            Register
          </a>
        </p>
      </div>

      {/* Server Error Alert */}
      {errorMessage && (
        <div
          style={{
            padding: "12px",
            background: "#fee2e2",
            border: "1px solid #ef4444",
            borderRadius: "6px",
            color: "#b91c1c",
            marginBottom: "1.5rem",
          }}
        >
          ⚠️ <strong>Notice:</strong> {errorMessage}
        </div>
      )}

      {/* 2. Online Users */}
      <div
        style={{
          marginBottom: "1.5rem",
          padding: "1rem",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
        }}
      >
        <h3>👥 Online User IDs:</h3>
        <p
          style={{
            fontWeight: "bold",
            fontSize: "1.2rem",
            color: "#16a34a",
          }}
        >
          {onlineUserIDs.length > 0
            ? JSON.stringify(onlineUserIDs)
            : "[] (No active sessions)"}
        </p>
      </div>

      {/* 3. Send Message */}
      <div
        style={{
          marginBottom: "1.5rem",
          padding: "1rem",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
        }}
      >
        <h3>✉️ Send Message:</h3>
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", marginBottom: "5px" }}>
            Recipient User ID:
          </label>
          <input
            type="number"
            value={recipientID}
            onChange={(e) => setRecipientID(e.target.value)}
            style={{
              padding: "8px",
              width: "120px",
              border: "1px solid #ccc",
              borderRadius: "4px",
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
              padding: "8px 12px",
              flex: 1,
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
          <button
            onClick={() => {
              handleSendMessage();
              handleTyping(false);
            }}
            style={{
              padding: "8px 20px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Send
          </button>
        </div>
      </div>

      {/* 4. Live Received Events */}
      <div
        style={{
          padding: "1rem",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          background: "#f9fafb",
        }}
      >
        <h3>📥 Latest Message Stream:</h3>
        <pre
          style={{
            background: "#1e293b",
            color: "#f8fafc",
            padding: "1rem",
            borderRadius: "6px",
            overflowX: "auto",
          }}
        >
          {lastMessage
            ? JSON.stringify(lastMessage, null, 2)
            : "// No messages received yet"}
        </pre>

        {typingStatus?.is_typing && (
          <p
            style={{
              color: "#2563eb",
              fontStyle: "italic",
              marginTop: "10px",
            }}
          >
            ✍️ User {typingStatus.sender_id} is typing...
          </p>
        )}
      </div>
    </main>
  );
}
