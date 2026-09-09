"use client";

export default function EmptyChat() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#080b1a]/95 text-slate-400 min-w-0">
      <div className="w-18 h-18 rounded-full bg-indigo-500/15 flex items-center justify-center text-3xl mb-4">
        💬
      </div>
      <h2 className="m-0 mb-2 text-slate-100 text-xl font-semibold">
        Your Messages
      </h2>
      <p className="max-w-[340px] m-0 text-sm leading-relaxed text-slate-500">
        Select a conversation from the sidebar to view chat history and start messaging in real time.
      </p>
    </div>
  );
}
