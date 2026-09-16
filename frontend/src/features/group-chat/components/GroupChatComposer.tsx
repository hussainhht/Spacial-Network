"use client";

import { useCallback, useRef } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { MAX_GROUP_MESSAGE_LENGTH } from "../hooks/useGroupChatController";
import styles from "../group-chat.module.css";

interface GroupChatComposerProps {
  inputText: string;
  setInputText: (text: string) => void;
  charCount: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
  disabled?: boolean;
  onSendMessage: () => boolean;
}

export default function GroupChatComposer({
  inputText,
  setInputText,
  charCount,
  isOverLimit,
  isNearLimit,
  disabled = false,
  onSendMessage,
}: GroupChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 44), 140)}px`;
  }, []);

  const doSubmit = useCallback(() => {
    if (disabled || isOverLimit || !inputText.trim()) return;

    const sent = onSendMessage();
    if (sent && textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, [disabled, isOverLimit, inputText, onSendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Do not submit while composing with an IME (e.g. Japanese, Chinese, or Arabic suggestions)
    if (e.nativeEvent.isComposing) return;

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSubmit();
    }
  };

  const isSendDisabled = disabled || isOverLimit || !inputText.trim();

  return (
    <form onSubmit={handleSubmit} className={styles.composerForm}>
      <div className={styles.composerInputWrapper}>
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          disabled={disabled}
          maxLength={MAX_GROUP_MESSAGE_LENGTH + 1}
          placeholder="Message the group…"
          className={styles.composerTextarea}
          aria-label="Group message text"
          dir="auto"
          onChange={(e) => {
            setInputText(e.target.value);
            resizeTextarea();
          }}
          onKeyDown={handleKeyDown}
        />

        <span
          className={`${styles.charCounter} ${
            isOverLimit
              ? styles.charCounterOver
              : isNearLimit
                ? styles.charCounterNear
                : ""
          }`}
          aria-live="polite"
        >
          {isOverLimit
            ? `-${charCount - MAX_GROUP_MESSAGE_LENGTH}`
            : `${charCount}/${MAX_GROUP_MESSAGE_LENGTH}`}
        </span>
      </div>

      <button
        type="submit"
        disabled={isSendDisabled}
        className={styles.sendButton}
        aria-label="Send message"
      >
        <AppIcon name="send" width={18} height={18} />
      </button>
    </form>
  );
}
