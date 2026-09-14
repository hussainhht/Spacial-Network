"use client";

import { useMemo, useState } from "react";
import type { ChatSidebarProps } from "../types/chat";
import { formatConversationDate, getDisplayName, getInitials } from "@/lib/utils";
import NewChatModal from "./NewChatModal";

export default function ChatSidebar({
  conversations,
  activeUserId,
  onlineUserIDs,
  loading,
  onSelectConversation,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.partner_username.toLowerCase().includes(q) ||
        c.partner_first_name.toLowerCase().includes(q) ||
        c.partner_last_name.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  return (
    <aside className="w-80 flex flex-col border-r border-[var(--planet-border)] bg-[#0b1026]/70 backdrop-blur-md h-full shrink-0">
      <div className="p-4 border-b border-slate-700/30">
        <div className="flex items-center justify-between mb-3">
          <h2 className="m-0 text-lg font-bold text-slate-100">Messages</h2>
          <button
            type="button"
            onClick={() => setIsNewChatOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--planet-accent-active)] hover:brightness-110 text-white shadow-sm transition-[filter] cursor-pointer"
            title="Start a new chat"
          >
            <span>+</span> New Chat
          </button>
        </div>
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-700/60 bg-[#10152f]/80 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-[var(--planet-accent)] focus:ring-2 focus:ring-[var(--planet-border)] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-slate-400 hover:text-slate-200 text-base cursor-pointer px-1 leading-none"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
        {loading && (
          <p className="py-8 px-4 text-center text-slate-400 text-sm">
            Loading conversations...
          </p>
        )}

        {!loading && filteredConversations.length === 0 && (
          <p className="py-8 px-4 text-center text-slate-400 text-sm">
            {searchQuery ? "No matching contacts found." : "No conversations yet."}
          </p>
        )}

        {!loading &&
          filteredConversations.map((c) => {
            const isOnline = onlineUserIDs.includes(c.partner_id);
            const isActive = activeUserId === c.partner_id;
            const displayName = getDisplayName(
              c.partner_first_name,
              c.partner_last_name,
              c.partner_username
            );
            const initials = getInitials(
              c.partner_first_name,
              c.partner_last_name,
              c.partner_username
            );

            return (
              <div
                key={c.partner_id}
                onClick={() => onSelectConversation(c.partner_id, c.partner_username)}
                className={`flex items-center px-3.5 py-2.5 gap-3 cursor-pointer transition-colors border-l-[3px] ${
                  isActive
                    ? "bg-[var(--planet-accent-soft)] border-[var(--planet-accent)]"
                    : "border-transparent hover:bg-slate-800/40"
                }`}
              >
                <div className="relative shrink-0 w-11 h-11">
                  {c.partner_avatar ? (
                    <img
                      src={c.partner_avatar}
                      alt={displayName}
                      className="w-11 h-11 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-[var(--planet-accent-active)] text-white flex items-center justify-center font-semibold text-sm">
                      {initials}
                    </div>
                  )}
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#0b1026] ${
                      isOnline ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                    title={isOnline ? "Online" : "Offline"}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-semibold text-sm text-slate-100 truncate">
                      {displayName}
                    </span>
                    <span className="text-xs text-slate-400 shrink-0 ml-2">
                      {formatConversationDate(c.last_message_at)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs text-slate-400 truncate">
                      {c.last_message || "No messages yet"}
                    </span>
                    {c.unread_count > 0 && (
                      <span className="bg-[var(--planet-accent-active)] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                        {c.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onSelectContact={(contact) => {
          onSelectConversation(contact.id, contact.username, contact.profile_photo);
          setIsNewChatOpen(false);
        }}
        onlineUserIDs={onlineUserIDs}
      />
    </aside>
  );
}
