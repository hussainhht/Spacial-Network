"use client";

import { useChat } from "../hooks/useChat";
import ChatSidebar from "./ChatSidebar";
import ChatWindow from "./ChatWindow";
import EmptyChat from "./EmptyChat";

export default function ChatPageContent() {
  const {
    errorMessage,
    myUserId,
    conversations,
    loadingConversations,
    activePartnerId,
    activePartnerUsername,
    activePartnerAvatar,
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

  return (
    <main style={styles.pageShell}>
      {errorMessage && (
        <div style={styles.errorAlert}>
          ⚠️ <strong>Notice:</strong> {errorMessage}
        </div>
      )}

      <div style={styles.layout}>
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

const styles: Record<string, React.CSSProperties> = {
  pageShell: {
    display: "flex",
    flexDirection: "column",
    height: "calc(100vh - 60px)",
    minHeight: "500px",
    background: "#050816",
    color: "#f8fafc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
  },
  errorAlert: {
    padding: "10px 16px",
    background: "rgba(239, 68, 68, 0.15)",
    borderBottom: "1px solid rgba(239, 68, 68, 0.3)",
    color: "#fca5a5",
    fontSize: "0.85rem",
  },
  layout: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
  },
};
