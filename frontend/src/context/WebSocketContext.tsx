"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type {
  MessagePayload,
  OnlineUsersPayload,
  TypingPayload,
  UserStatusPayload,
  WebSocketContextType,
  ErrorPayload,
} from "@/types/websocket";

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIDs, setOnlineUserIDs] = useState<number[]>([]);
  const [lastMessage, setLastMessage] = useState<MessagePayload | null>(null);
  const [typingStatus, setTypingStatus] = useState<TypingPayload | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function connect() {
    if (typeof window === "undefined") return;

    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      const ws = new WebSocket("ws://localhost:8080/api/ws");
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        socketRef.current = null;
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "online_users":
              setOnlineUserIDs((data.payload as OnlineUsersPayload).user_ids || []);
              break;
            case "user_online": {
              const p = data.payload as UserStatusPayload;
              setOnlineUserIDs((prev) => (prev.includes(p.user_id) ? prev : [...prev, p.user_id]));
              break;
            }
            case "user_offline": {
              const p = data.payload as UserStatusPayload;
              setOnlineUserIDs((prev) => prev.filter((id) => id !== p.user_id));
              break;
            }
            case "private_message":
              setLastMessage(data.payload as MessagePayload);
              break;
            case "typing":
              setTypingStatus(data.payload as TypingPayload);
              break;
            case "error":
              console.error("WS error:", (data.payload as ErrorPayload)?.message);
              break;
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };
    } catch (err) {
      console.warn("Could not create WebSocket connection:", err);
    }
  }

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  function sendMessage(recipientID: number, content: string) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket is not connected");
      return;
    }
    socketRef.current.send(
      JSON.stringify({
        type: "private_message",
        payload: { recipient_id: recipientID, content: content.trim() },
      })
    );
  }

  function sendTyping(recipientID: number, isTyping: boolean) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(
      JSON.stringify({
        type: "typing",
        payload: { recipient_id: recipientID, is_typing: isTyping },
      })
    );
  }

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        onlineUserIDs,
        lastMessage,
        typingStatus,
        sendMessage,
        sendTyping,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
