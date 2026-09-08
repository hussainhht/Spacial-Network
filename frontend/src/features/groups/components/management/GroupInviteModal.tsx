"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import GroupInviteSearch from "./GroupInviteSearch";

interface GroupInviteModalProps {
  groupId: number;
  open: boolean;
  onClose: () => void;
}

export default function GroupInviteModal({
  groupId,
  open,
  onClose,
}: GroupInviteModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Kept separate from the Escape-key effect below: this one must only run
  // when `open` toggles, not whenever `onClose` is re-created by a parent
  // render, or focus/scroll-lock would reset mid-typing in the search input.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const scrollContainer = document.getElementById("page-content");
    const previousOverflow = scrollContainer?.style.overflow ?? "";
    if (scrollContainer) scrollContainer.style.overflow = "hidden";

    return () => {
      if (scrollContainer) scrollContainer.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="group-modal-overlay" onClick={onClose}>
      <div
        className="group-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="group-modal-header">
          <h2 id="invite-modal-title">Invite people</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="group-modal-close"
            aria-label="Close invite dialog"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="group-modal-body">
          <GroupInviteSearch groupId={groupId} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
