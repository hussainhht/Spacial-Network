import { Suspense } from "react";
import ChatPageContent from "@/features/chat/components/ChatPageContent";

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading chat...</div>}>
      <ChatPageContent />
    </Suspense>
  );
}
