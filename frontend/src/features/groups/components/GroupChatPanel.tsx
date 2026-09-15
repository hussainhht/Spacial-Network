"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGroupChat } from "../hooks/useGroupChat";
import PostSharePreview from "@/features/interactions/components/PostSharePreview";
import { parseSharedPost } from "@/features/interactions/utils/sharedPost";
import { formatMessageDateTime, getDisplayName, getInitials } from "@/lib/utils";
import { getBackendBaseUrl } from "@/lib/api";

const MAX_MESSAGE_LENGTH = 2000;
const NEAR_LIMIT_THRESHOLD = 1800;

interface GroupChatPanelProps {
  groupId: number;
  isMember: boolean;
}

export default function GroupChatPanel({ groupId, isMember }: GroupChatPanelProps) {
  const {
    isConnected,
    myUserId,
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    sendGroupMessage,
    loadMoreHistory,
  } = useGroupChat(groupId, isMember);

  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const charCount = inputText.length;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;
  const isNearLimit = charCount >= NEAR_LIMIT_THRESHOLD;

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputText.trim() || isOverLimit || !isMember) return;

    sendGroupMessage(inputText.trim());
    setInputText("");
  }

  const getFullPhotoUrl = (path?: string) => {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${getBackendBaseUrl()}${cleanPath}`;
  };

  if (!isMember) {
    return (
      <div className="p-10 text-center bg-[#0b1026]/70 border border-[var(--planet-border)] rounded-2xl shadow-lg my-4">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="text-base font-semibold text-slate-100 mb-1.5">Group Chat is Member-Only</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto mb-0 leading-relaxed">
          You must be a member of this group to view and participate in the group chat. Request to join or accept an invitation to chat with members!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[650px] max-h-[75vh] bg-[#080b1a]/95 border border-[var(--planet-border)] rounded-2xl overflow-hidden shadow-xl my-4 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/30 bg-[#0f1533]">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">💬</span>
          <span className="font-semibold text-slate-100 text-sm">Community Chat</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-amber-500"
            }`}
          />
          <span className="text-xs text-slate-400">
            {isConnected ? "Connected" : "Connecting..."}
          </span>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/15 border-b border-red-500/30 text-red-300 text-xs">
          ⚠️ {error}
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-w-0">
        {hasMore && (
          <div className="text-center py-1">
            <button
              type="button"
              onClick={loadMoreHistory}
              disabled={loadingMore}
              className="text-xs text-[var(--planet-accent)] hover:text-[var(--planet-accent-hover)] font-medium px-3.5 py-1.5 rounded-lg bg-[var(--planet-accent-soft)] hover:bg-[var(--planet-border)] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loadingMore ? "Loading older messages..." : "↑ Load older messages"}
            </button>
          </div>
        )}

        {loading && (
          <div className="py-16 text-center text-slate-400 text-sm">
            <div className="inline-block w-5 h-5 border-2 border-[var(--planet-accent)] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="m-0 text-xs text-slate-400">Loading chat history...</p>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="py-20 text-center text-slate-400">
            <div className="text-4xl mb-2">💬</div>
            <h4 className="text-sm font-semibold text-slate-200 m-0">No messages yet</h4>
            <p className="text-xs text-slate-400 mt-1 mb-0">
              Send the first message to kick off the group chat!
            </p>
          </div>
        )}

        {!loading &&
          messages.map((msg) => {
            const isMine = myUserId !== null && msg.user_id === myUserId;
            const displayName = getDisplayName(
              msg.first_name || "",
              msg.last_name || "",
              msg.username || ""
            );
            const initials = getInitials(
              msg.first_name || "",
              msg.last_name || "",
              msg.username || ""
            );
            const avatarUrl = getFullPhotoUrl(msg.avatar);

            return (
              <div
                key={msg.id ?? `${msg.user_id}-${msg.created_at}`}
                className={`flex gap-2.5 min-w-0 ${isMine ? "justify-end" : "justify-start"}`}
              >
                {!isMine && (
                  <div className="shrink-0 pt-0.5">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[var(--planet-accent-active)] text-white flex items-center justify-center font-bold text-[10px]">
                        {initials}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col max-w-[75%] min-w-0">
                  {!isMine && (
                    <div className="flex items-baseline gap-1.5 mb-1 px-1">
                      <Link
                        href={`/profile/${msg.username}`}
                        className="text-xs font-semibold text-slate-200 hover:text-[var(--planet-accent)] transition-colors truncate"
                      >
                        {displayName}
                      </Link>
                      {msg.username && (
                        <span className="text-[11px] text-slate-400 truncate">
                          @{msg.username}
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    className={`px-3.5 py-2 rounded-2xl text-sm min-w-0 ${
                      isMine
                        ? "rounded-br-xs bg-[var(--planet-accent-active)] text-white"
                        : "rounded-bl-xs bg-slate-800/90 text-slate-100 border border-slate-700/50"
                    }`}
                  >
                    {(() => {
                      const shared = parseSharedPost(msg.content);
                      if (!shared) {
                        return (
                          <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed text-[13.5px]">
                            {msg.content}
                          </div>
                        );
                      }
                      return (
                        <>
                          {shared.note && (
                            <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed text-[13.5px] mb-1.5">
                              {shared.note}
                            </div>
                          )}
                          <PostSharePreview postId={shared.postId} />
                        </>
                      );
                    })()}
                    <div
                      className={`text-[10px] mt-1 text-right shrink-0 ${
                        isMine ? "text-slate-200" : "text-slate-400"
                      }`}
                    >
                      {msg.created_at ? formatMessageDateTime(msg.created_at) : ""}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2.5 px-4 py-3.5 border-t border-slate-700/30 bg-[#0b1026]/90 min-w-0 shrink-0"
      >
        <div className="flex-1 relative flex items-center min-w-0">
          <input
            type="text"
            placeholder="Message the group..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className={`w-full min-w-0 py-2 rounded-full border bg-[#10152f]/80 text-slate-100 placeholder-slate-400 text-sm focus:outline-none transition-colors ${
              isNearLimit ? "pr-20" : "pr-4"
            } pl-4 ${
              isOverLimit
                ? "border-red-500 focus:border-red-500"
                : isNearLimit
                ? "border-amber-500 focus:border-amber-500"
                : "border-slate-700/60 focus:border-[var(--planet-accent)] focus:ring-2 focus:ring-[var(--planet-border)]"
            }`}
          />
          {isNearLimit && (
            <span
              className={`absolute right-3 text-xs font-semibold pointer-events-none select-none bg-[#0b1026]/90 px-1.5 py-0.5 rounded-md shrink-0 ${
                isOverLimit ? "text-red-400" : "text-amber-400"
              }`}
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
          className={`shrink-0 px-4.5 py-2 rounded-full font-semibold text-xs transition-all duration-150 ${
            !inputText.trim() || isOverLimit
              ? "bg-slate-700 text-slate-400 opacity-50 cursor-not-allowed"
              : "bg-[var(--planet-accent-active)] hover:brightness-110 text-white cursor-pointer shadow-sm"
          }`}
        >
          Send
        </button>
      </form>
    </div>
  );
}
