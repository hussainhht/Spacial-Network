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
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Kept separate from the Escape-key effect below: this one must only run
  // when `open` toggles, not whenever `onClose` is re-created by a parent
  // render, or focus/scroll-lock would reset mid-typing in the search input.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

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
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="group-modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="group-modal group-invite-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
        aria-describedby="invite-modal-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="group-modal-header group-invite-modal-header">
          <div className="group-invite-modal-heading">
            <h2 id="invite-modal-title">Invite Members</h2>
            <p id="invite-modal-description">
              Search for people to invite directly to this group
            </p>
          </div>
          <button
            type="button"
            className="group-modal-close"
            aria-label="Close invite dialog"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
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
