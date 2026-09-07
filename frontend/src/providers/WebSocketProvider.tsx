"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { getWebSocketUrl } from "@/lib/api";
import type {
  EventType,
  MessagePayload,
  OnlineUsersPayload,
  TypingPayload,
  UserStatusPayload,
  WebSocketContextType,
  ErrorPayload,
  InviteUserSearchResultsPayload,
  NotificationEventPayload,
  GroupEventResponseUpdatedPayload,
} from "@/lib/websocket/types";

const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined,
);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUserIDs, setOnlineUserIDs] = useState<number[]>([]);
  const [lastMessage, setLastMessage] = useState<MessagePayload | null>(null);
  const [typingStatus, setTypingStatus] = useState<TypingPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteSearchResults, setInviteSearchResults] =
    useState<InviteUserSearchResultsPayload | null>(null);
  const [lastNotification, setLastNotification] =
    useState<NotificationEventPayload | null>(null);
  const [lastEventResponseUpdate, setLastEventResponseUpdate] =
    useState<GroupEventResponseUpdatedPayload | null>(null);

  const eventResponseListeners = useRef(new Set<(event: GroupEventResponseUpdatedPayload) => void>());
  const subscribeEventResponses = useCallback((listener: (event: GroupEventResponseUpdatedPayload) => void) => {
    eventResponseListeners.current.add(listener);
    return () => { eventResponseListeners.current.delete(listener); };
  }, []);

  const notificationListeners = useRef(
    new Set<(notification: NotificationEventPayload) => void>(),
  );
  const subscribeNotifications = useCallback(
    (listener: (notification: NotificationEventPayload) => void) => {
      notificationListeners.current.add(listener);
      return () => {
        notificationListeners.current.delete(listener);
      };
    },
    [],
  );

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isConnectingRef = useRef(false);

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    try {
      const ws = new WebSocket(getWebSocketUrl("/api/ws"));
      socketRef.current = ws;

      ws.onopen = () => {
        isConnectingRef.current = false;
        setIsConnected(true);
        setErrorMessage(null);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onclose = () => {
        isConnectingRef.current = false;
        setIsConnected(false);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(connect, 300);
      };

      ws.onerror = () => {
        isConnectingRef.current = false;
        console.warn(
          "WebSocket connection notice (normal if logged out or server restarted)",
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "online_users":
              setOnlineUserIDs(
                (data.payload as OnlineUsersPayload).user_ids || [],
              );
              break;
            case "user_online": {
              const p = data.payload as UserStatusPayload;
              setOnlineUserIDs((prev) =>
                prev.includes(p.user_id) ? prev : [...prev, p.user_id],
              );
              break;
            }
            case "user_offline": {
              const p = data.payload as UserStatusPayload;
              setOnlineUserIDs((prev) => prev.filter((id) => id !== p.user_id));
              break;
            }
            case "private_message":
              setLastMessage(data.payload as MessagePayload);
              setErrorMessage(null);
              break;
            case "typing":
              setTypingStatus(data.payload as TypingPayload);
              break;
            case "invite_user_search_results":
              setInviteSearchResults(
                data.payload as InviteUserSearchResultsPayload,
              );
              break;
            case "notification": {
              const notification = data.payload as NotificationEventPayload;
              setLastNotification(notification); // Preserve existing consumers.
              notificationListeners.current.forEach((listener) =>
                listener(notification),
              );
              break;
            }
            case "group_event_response_updated": {
              const update = data.payload as GroupEventResponseUpdatedPayload;
              setLastEventResponseUpdate(update);
              eventResponseListeners.current.forEach(listener => listener(update));
              break;
            }
            case "error": {
              const errPayload = data.payload as ErrorPayload;
              console.error("WS error:", errPayload?.message);
              setErrorMessage(errPayload?.message || "An error occurred");
              break;
            }
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };
    } catch (err) {
      isConnectingRef.current = false;
      console.warn("Could not create WebSocket connection:", err);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
      // Detaching onclose above means its isConnectingRef reset never runs
      // for the socket being torn down here, so do it ourselves - otherwise
      // a StrictMode dev remount (mount -> cleanup -> mount) leaves the flag
      // stuck at true and the next connect() call no-ops forever.
      isConnectingRef.current = false;
    };
  }, [connect]);

  // Memoized so its identity is stable across renders - otherwise every WS
  // message (even unrelated ones, e.g. someone else going online) would
  // recreate this function, and any consumer effect that depends on it
  // (like a debounced search) would spuriously re-fire on every message.
  const sendEvent = useCallback(
    function sendEvent(type: EventType, payload: unknown) {
      if (
        !socketRef.current ||
        socketRef.current.readyState !== WebSocket.OPEN
      ) {
        if (socketRef.current?.readyState === WebSocket.CONNECTING) {
          // If connecting, retry in 500ms
          setTimeout(() => sendEvent(type, payload), 500);
          return;
        }
        console.warn(
          "WebSocket is not connected (readyState:",
          socketRef.current?.readyState,
          ")",
        );
        setErrorMessage("WebSocket is not connected. Reconnecting...");
        connect();
        return;
      }
      setErrorMessage(null);
      socketRef.current.send(JSON.stringify({ type, payload }));
    },
    [connect],
  );

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        onlineUserIDs,
        lastMessage,
        typingStatus,
        errorMessage,
        inviteSearchResults,
        lastNotification,
        lastEventResponseUpdate,
        subscribeNotifications,
        subscribeEventResponses,
        sendEvent,
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
