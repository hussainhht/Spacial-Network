"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import styles from "./ActionFeedbackProvider.module.css";

type FeedbackTone = "success" | "error";

interface FeedbackMessage {
  id: number;
  text: string;
  tone: FeedbackTone;
}

interface ActionFeedbackValue {
  notify: (text: string, tone?: FeedbackTone) => void;
}

const ActionFeedbackContext = createContext<ActionFeedbackValue | null>(null);

export function ActionFeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<FeedbackMessage | null>(null);

  const notify = useCallback((text: string, tone: FeedbackTone = "success") => {
    setMessage({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ActionFeedbackContext.Provider value={value}>
      {children}
      {message && (
        <div
          key={message.id}
          className={styles.toast}
          data-tone={message.tone}
          role={message.tone === "error" ? "alert" : "status"}
          aria-live={message.tone === "error" ? "assertive" : "polite"}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}
    </ActionFeedbackContext.Provider>
  );
}

export function useActionFeedback() {
  const value = useContext(ActionFeedbackContext);
  if (!value) {
    throw new Error(
      "useActionFeedback must be used inside ActionFeedbackProvider.",
    );
  }
  return value;
}
