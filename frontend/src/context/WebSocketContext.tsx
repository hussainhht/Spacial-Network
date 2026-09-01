"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";

export interface MessagePayload {
    id?: number;
    sender_id: number;
    recipient_id: number;
    content: string;
    created_at?: string;
}

export interface TypingPayload {
    sender_id: number;
    recipient_id: number;
    is_typing: boolean;
}

export interface UserStatusPayload {
    user_id: number;
    is_online: boolean;
}

export interface OnlineUsersPayload {
    user_ids: number[];
}

export interface WebSocketContextType {
    isConnected: boolean;
    onlineUserIDs: number[];
    lastMessage: MessagePayload | null;
    typingStatus: TypingPayload | null;
    sendMessage: (recipientID: number, content: string) => void;
    sendTyping: (recipientID: number, isTyping: boolean) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUserIDs, setOnlineUserIDs] = useState<number[]>([]);
    const [lastMessage, setLastMessage] = useState<MessagePayload | null>(null);
    const [typingStatus, setTypingStatus] = useState<TypingPayload | null>(null);

    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    function connect() {
        if (typeof window === "undefined") {
            return;
        }

        if (
            socketRef.current &&
            (socketRef.current.readyState === WebSocket.OPEN ||
                socketRef.current.readyState === WebSocket.CONNECTING)
        ) {
            return;
        }

        const wsUrl = "ws://localhost:8080/api/ws";
        let ws: WebSocket;
        try {
            ws = new WebSocket(wsUrl);
        } catch (err) {
            console.warn("Could not create WebSocket connection:", err);
            return;
        }
        socketRef.current = ws;

        ws.onopen = () => {
            console.log("WebSocket connected");
            setIsConnected(true);
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };

        ws.onclose = () => {
            setIsConnected(false);
            socketRef.current = null;

            // Auto-reconnect after 3 seconds
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            reconnectTimeoutRef.current = setTimeout(() => {
                connect();
            }, 3000);
        };

        ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case "online_users": {
                        const payload: OnlineUsersPayload = data.payload;
                        setOnlineUserIDs(payload.user_ids || []);
                        break;
                    }

                    case "user_online": {
                        const payload: UserStatusPayload = data.payload;
                        setOnlineUserIDs((prev) =>
                            prev.includes(payload.user_id) ? prev : [...prev, payload.user_id]
                        );
                        break;
                    }

                    case "user_offline": {
                        const payload: UserStatusPayload = data.payload;
                        setOnlineUserIDs((prev) => prev.filter((id) => id !== payload.user_id));
                        break;
                    }

                    case "private_message": {
                        const payload: MessagePayload = data.payload;
                        setLastMessage(payload);
                        break;
                    }

                    case "typing": {
                        const payload: TypingPayload = data.payload;
                        setTypingStatus(payload);
                        break;
                    }

                    case "error": {
                        console.error("WebSocket server error:", data.payload.message);
                        break;
                    }

                    default:
                        console.warn("Unhandled WebSocket event:", data.type);
                }
            } catch (err) {
                console.error("Error parsing WebSocket message:", err);
            }
        };
    }

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (socketRef.current) {
                socketRef.current.close();
            }
        };
    }, []);

    function sendMessage(recipientID: number, content: string) {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            console.warn("WebSocket is not connected");
            return;
        }

        const event = {
            type: "private_message",
            payload: {
                recipient_id: recipientID,
                content: content.trim(),
            },
        };

        socketRef.current.send(JSON.stringify(event));
    }

    function sendTyping(recipientID: number, isTyping: boolean) {
        if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            return;
        }

        const event = {
            type: "typing",
            payload: {
                recipient_id: recipientID,
                is_typing: isTyping,
            },
        };

        socketRef.current.send(JSON.stringify(event));
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
