"use client";

import { useEffect, useState } from "react";
import { getEligibleContacts } from "../api/chat";
import type { EligibleContact } from "../types/chat";
import { getDisplayName, getInitials } from "@/lib/utils";
import { getBackendBaseUrl } from "@/lib/api";

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectContact: (contact: EligibleContact) => void;
  onlineUserIDs: number[];
}

export default function NewChatModal({
  isOpen,
  onClose,
  onSelectContact,
  onlineUserIDs,
}: NewChatModalProps) {
  const [contacts, setContacts] = useState<EligibleContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setContacts([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const trimmed = searchQuery.trim();
    const delay = trimmed ? 250 : 0;

    const timer = setTimeout(() => {
      getEligibleContacts(trimmed, 20, 0)
        .then((data) => {
          if (isMounted) {
            setContacts(data);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(err instanceof Error ? err.message : "Failed to load contacts");
          }
        })
        .finally(() => {
          if (isMounted) {
            setLoading(false);
          }
        });
    }, delay);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, searchQuery]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getFullPhotoUrl = (path: string) => {
    if (/^https?:\/\//i.test(path)) return path;
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${getBackendBaseUrl()}${cleanPath}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="new-chat-title"
    >
      <div
        className="w-full max-w-md bg-[#0b1026] border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/40 bg-[#0f1533]">
          <div className="flex items-center gap-2">
            <span className="text-lg">💬</span>
            <h2 id="new-chat-title" className="m-0 text-base font-bold text-slate-100">
              New Message
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-700/50 transition-colors text-lg leading-none cursor-pointer"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {/* Search */}
        <div className="p-3.5 border-b border-slate-700/30 bg-[#0b1026]">
          <div className="relative flex items-center">
            <input
              type="text"
              autoFocus
              placeholder="Search people you follow or followers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-10 py-2 rounded-lg border border-slate-700/60 bg-[#10152f]/80 text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <div className="absolute right-2.5 flex items-center gap-1.5">
              {loading && (
                <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-slate-400 hover:text-slate-200 text-base cursor-pointer leading-none"
                  aria-label="Clear search"
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-1">
          {loading && contacts.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">
              <div className="inline-block w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
              <p>{searchQuery.trim() ? "Searching contacts..." : "Finding eligible contacts..."}</p>
            </div>
          )}

          {error && !loading && (
            <div className="py-8 px-4 text-center text-red-400 text-sm">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  getEligibleContacts(searchQuery.trim(), 20, 0)
                    .then(setContacts)
                    .catch((e) => setError(e instanceof Error ? e.message : "Failed to load contacts"))
                    .finally(() => setLoading(false));
                }}
                className="mt-2 text-xs text-indigo-400 hover:underline cursor-pointer"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && contacts.length === 0 && (
            <div className="py-10 px-6 text-center text-slate-400">
              {searchQuery.trim() ? (
                <>
                  <div className="text-3xl mb-2">🔍</div>
                  <h3 className="text-sm font-semibold text-slate-200 m-0">No contacts found</h3>
                  <p className="text-xs text-slate-400 mt-1 mb-0 leading-relaxed">
                    No contacts matching &ldquo;{searchQuery.trim()}&rdquo;
                  </p>
                </>
              ) : (
                <>
                  <div className="text-3xl mb-2">👥</div>
                  <h3 className="text-sm font-semibold text-slate-200 m-0">No eligible contacts</h3>
                  <p className="text-xs text-slate-400 mt-1 mb-0 leading-relaxed">
                    You can only message users you follow or who follow you. Follow people to chat with them!
                  </p>
                </>
              )}
            </div>
          )}

          {!loading &&
            !error &&
            contacts.map((contact) => {
              const isOnline = onlineUserIDs.includes(contact.id);
              const displayName = getDisplayName(
                contact.first_name,
                contact.last_name,
                contact.username
              );
              const initials = getInitials(
                contact.first_name,
                contact.last_name,
                contact.username
              );
              const avatarUrl = contact.profile_photo
                ? getFullPhotoUrl(contact.profile_photo)
                : "";

              return (
                <div
                  key={contact.id}
                  onClick={() => {
                    onSelectContact(contact);
                    onClose();
                  }}
                  className="flex items-center px-4 py-3 gap-3 cursor-pointer rounded-xl hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="relative shrink-0 w-10 h-10">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 text-white flex items-center justify-center font-semibold text-xs">
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
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="font-medium text-sm text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
                        {displayName}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 truncate block">
                      @{contact.username}
                    </span>
                  </div>

                  <span className="text-xs font-medium text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 px-2 py-1 rounded-md bg-indigo-500/10">
                    Chat &rarr;
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
