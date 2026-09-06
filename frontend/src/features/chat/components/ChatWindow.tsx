"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatWindowProps } from "../types/chat";
import { formatMessageDateTime, getInitials } from "@/lib/utils";

const MAX_MESSAGE_LENGTH = 2000;
const NEAR_LIMIT_THRESHOLD = 1800;

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

  const charCount = inputText.length;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;
  const isNearLimit = charCount >= NEAR_LIMIT_THRESHOLD;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    if (!inputText.trim() || isOverLimit) return;

    onSendMessage(inputText.trim());
    setInputText("");

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    onTyping(false);
  }

  const initials = getInitials("", "", partnerUsername);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#080b1a]/95 min-w-0">
      <header className="flex items-center justify-between px-6 py-3.5 border-b border-slate-700/30 bg-[#0b1026]/80 min-w-0 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-10 h-10 shrink-0">
            {partnerAvatar ? (
              <img
                src={partnerAvatar}
                alt={partnerUsername}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-white flex items-center justify-center font-semibold text-sm">
                {initials}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#080b1a] ${
                isPartnerOnline ? "bg-emerald-500" : "bg-slate-400"
              }`}
              title={isPartnerOnline ? "Online" : "Offline"}
            />
          </div>

          <div className="min-w-0">
            <h3 className="m-0 text-base font-semibold text-slate-100 truncate">{partnerUsername}</h3>
            <span className="text-xs truncate block">
              {isPartnerTyping ? (
                <span className="text-indigo-400 italic">✍️ typing...</span>
              ) : isPartnerOnline ? (
                <span className="text-emerald-500 font-medium">Online</span>
              ) : (
                <span className="text-slate-400">Offline</span>
              )}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 flex flex-col gap-2.5 min-w-0">
        {hasMoreHistory && (
          <div className="flex justify-center mb-2 shrink-0">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingHistory}
              className="bg-slate-800/60 hover:bg-slate-700/60 disabled:opacity-50 text-slate-300 border border-slate-700/40 px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors"
            >
              {loadingHistory ? "Loading older messages..." : "↑ Load older messages"}
            </button>
          </div>
        )}

        {messages.length === 0 && !loadingHistory && (
          <div className="m-auto text-center text-slate-400">
            <p className="text-sm">No messages with {partnerUsername} yet.</p>
            <p className="text-xs text-slate-500 mt-1">Say hello to start the conversation!</p>
          </div>
        )}

        {messages.map((msg, index) => {
          const isMine = myUserId !== null && msg.sender_id === myUserId;
          const isRead = Boolean(msg.read_at);

          return (
            <div
              key={msg.id || index}
              className={`flex w-full min-w-0 ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`chat-bubble max-w-[70%] sm:max-w-[65%] min-w-0 px-3.5 py-2.5 rounded-2xl break-words [overflow-wrap:anywhere] [word-break:break-word] leading-relaxed shadow-sm ${
                  isMine
                    ? "rounded-br-xs bg-gradient-to-br from-indigo-600 to-blue-600 text-white"
                    : "rounded-bl-xs bg-slate-800 text-slate-100 border border-slate-700/50"
                }`}
              >
                <div className="chat-message-content text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]">
                  {msg.content}
                </div>

                <div
                  className={`flex items-center gap-1 mt-1 shrink-0 ${
                    isMine ? "justify-end" : "justify-start"
                  }`}
                >
                  <time className="text-[11px] opacity-75 shrink-0">
                    {formatMessageDateTime(msg.created_at)}
                  </time>
                  {isMine && (
                    <span
                      className={`text-xs font-bold ml-0.5 shrink-0 ${
                        isRead ? "text-blue-300" : "text-slate-400"
                      }`}
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
          <div className="flex w-full justify-start min-w-0">
            <div className="max-w-[70%] min-w-0 px-3.5 py-2 rounded-2xl rounded-bl-xs bg-slate-800/85 border border-slate-700/50 text-slate-300 text-xs italic truncate">
              {partnerUsername} is typing...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2.5 px-6 py-4 border-t border-slate-700/30 bg-[#0b1026]/90 min-w-0 shrink-0">
        <div className="flex-1 relative flex items-center min-w-0">
          <input
            type="text"
            placeholder={`Message ${partnerUsername}...`}
            value={inputText}
            onChange={handleInputChange}
            className={`w-full min-w-0 py-2.5 rounded-full border bg-[#10152f]/80 text-slate-100 placeholder-slate-400 text-sm focus:outline-none transition-colors ${
              isNearLimit ? "pr-20" : "pr-4"
            } pl-4.5 ${
              isOverLimit
                ? "border-red-500 focus:border-red-500"
                : isNearLimit
                ? "border-amber-500 focus:border-amber-500"
                : "border-slate-700/60 focus:border-indigo-500"
            }`}
          />
          {isNearLimit && (
            <span
              className={`absolute right-3.5 text-xs font-semibold pointer-events-none select-none bg-[#0b1026]/90 px-1.5 py-0.5 rounded-md shrink-0 ${
                isOverLimit ? "text-red-400" : "text-amber-400"
              }`}
              title={
                isOverLimit
                  ? `${charCount - MAX_MESSAGE_LENGTH} characters over limit`
                  : `${MAX_MESSAGE_LENGTH - charCount} characters remaining`
              }
            >
              {isOverLimit
                ? `-${charCount - MAX_MESSAGE_LENGTH}`
                : `${charCount}/${MAX_MESSAGE_LENGTH}`}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!inputText.trim() || isOverLimit}
          className={`shrink-0 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${
            !inputText.trim() || isOverLimit
              ? "bg-slate-700 text-slate-400 opacity-50 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-sm"
          }`}
        >
          Send
        </button>
      </form>
    </div>
  );
}
