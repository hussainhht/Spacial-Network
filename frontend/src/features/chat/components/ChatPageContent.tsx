"use client";

import { useState } from "react";
import { useChat } from "../hooks/useChat";
import ChatSidebar from "./ChatSidebar";
import ChatWindow from "./ChatWindow";
import EmptyChat from "./EmptyChat";
import styles from "./Chat.module.css";

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
    <main className={styles.chatContainer}>
      {activeError && (
        <div className={styles.errorBanner}>
          <span>⚠️ <strong>Notice:</strong> {activeError}</span>
          <button
            type="button"
            onClick={() => setDismissedError(activeError)}
            className={styles.dismissErrorBtn}
            aria-label="Dismiss notice"
          >
            &times;
          </button>
        </div>
      )}

      <div className={styles.cardsWrapper}>
        <div className={`${styles.sidebarCard} ${activePartnerId ? styles.hideOnMobile : ""}`}>
          <ChatSidebar
            conversations={conversations}
            activeUserId={activePartnerId}
            onlineUserIDs={onlineUserIDs}
            loading={loadingConversations}
            onSelectConversation={selectConversation}
          />
        </div>

        <div className={`${styles.chatCard} ${!activePartnerId ? styles.hideOnMobile : ""}`}>
          {activePartnerId ? (
            <ChatWindow
              key={`chat-${activePartnerId}`}
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
              onBack={() => selectConversation(0, "")}
            />
          ) : (
            <EmptyChat key="empty" />
          )}
        </div>
      </div>
    </main>
  );
}
