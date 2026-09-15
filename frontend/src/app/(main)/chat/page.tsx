import { Suspense } from "react";
import PageTransition from "@/components/transitions/PageTransition";
import ChatPageContent from "@/features/chat/components/ChatPageContent";
import styles from "@/features/chat/components/Chat.module.css";

export default function ChatPage() {
  return (
    <PageTransition className={styles.chatRoute}>
      <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading chat...</div>}>
        <ChatPageContent />
      </Suspense>
    </PageTransition>
  );
}
