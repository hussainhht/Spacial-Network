"use client";

import { useState } from "react";
import { useChat } from "../hooks/useChat";
import ChatSidebar from "./ChatSidebar";
import ChatWindow from "./ChatWindow";
import EmptyChat from "./EmptyChat";

export default function ChatPageContent() {
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const {
    errorMessage,
    myUserId,
    conversations,
    loadingConversations,
    activePartnerId,
    activePartnerUsername,
    activePartnerAvatar,
    isPartnerEligible,
    messages,
    loadingHistory,
    hasMoreHistory,
    isPartnerOnline,
    isPartnerTyping,
    onlineUserIDs,
    selectConversation,
    loadMoreHistory,
    sendMessage,
    sendTyping,
  } = useChat();

  const activeError = errorMessage && errorMessage !== dismissedError ? errorMessage : null;

  return (
    <main className="chat-main flex flex-col h-screen h-[100dvh] w-full min-w-0 overflow-hidden bg-[#050816] text-slate-100 font-sans">
      {activeError && (
        <div className="px-4 py-2.5 bg-red-500/15 border-b border-red-500/30 text-red-300 text-sm flex items-center justify-between shrink-0">
          <span>⚠️ <strong>Notice:</strong> {activeError}</span>
          <button
            type="button"
            onClick={() => setDismissedError(activeError)}
            className="text-red-300 hover:text-red-100 text-lg cursor-pointer px-1 leading-none ml-3"
            aria-label="Dismiss notice"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden min-w-0">
        <ChatSidebar
          conversations={conversations}
          activeUserId={activePartnerId}
          onlineUserIDs={onlineUserIDs}
          loading={loadingConversations}
          onSelectConversation={selectConversation}
        />

        {activePartnerId ? (
          <ChatWindow
            partnerId={activePartnerId}
            partnerUsername={activePartnerUsername}
            partnerAvatar={activePartnerAvatar}
            isPartnerOnline={isPartnerOnline}
            isPartnerTyping={isPartnerTyping}
            isEligible={isPartnerEligible}
            myUserId={myUserId}
            messages={messages}
            loadingHistory={loadingHistory}
            hasMoreHistory={hasMoreHistory}
            onLoadMore={loadMoreHistory}
            onSendMessage={sendMessage}
            onTyping={sendTyping}
          />
        ) : (
          <EmptyChat />
        )}
      </div>
    </main>
  );
}
