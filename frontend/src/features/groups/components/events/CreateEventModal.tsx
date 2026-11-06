"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useActionFeedback } from "@/components/feedback/ActionFeedbackProvider";
import CreateEventPanel from "./CreateEventPanel";

interface CreateEventModalProps {
  groupId: number;
  open: boolean;
  onClose: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export default function CreateEventModal({
  groupId,
  open,
  onClose,
}: CreateEventModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dirtyRef = useRef(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const { notify } = useActionFeedback();

  const requestClose = useCallback(() => {
    if (dirtyRef.current) setConfirmingDiscard(true);
    else onClose();
  }, [onClose]);
  const requestCloseRef = useRef(requestClose);
  useEffect(() => {
    requestCloseRef.current = requestClose;
  }, [requestClose]);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const handleCreated = useCallback(
    (title: string) => {
      dirtyRef.current = false;
      notify(`“${title}” was created.`, "success");
      onClose();
    },
    [notify, onClose],
  );

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const scrollContainer = document.getElementById("page-content");
    const previousOverflow = scrollContainer?.style.overflow ?? "";
    if (scrollContainer) scrollContainer.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => titleInputRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (!focusable.length) return;
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
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      if (scrollContainer) scrollContainer.style.overflow = previousOverflow;
      dirtyRef.current = false;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="group-modal-overlay" onClick={requestClose}>
      <div
        ref={dialogRef}
        className="group-modal group-create-event-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-event-heading"
        aria-describedby="create-event-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="group-modal-header group-create-event-modal-header">
          <div className="group-create-event-heading">
            <p className="group-eyebrow">New gathering</p>
            <h2 id="create-event-heading">Create event</h2>
            <p id="create-event-description">
              Share a moment for your group to look forward to.
            </p>
          </div>
          <button
            type="button"
            className="group-modal-close"
            aria-label="Close create event dialog"
            onClick={requestClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="group-modal-body">
          {confirmingDiscard && (
            <div
              className="group-create-event-discard"
              role="alertdialog"
              aria-label="Discard unsaved event?"
            >
              <p>Discard this event? Your changes will be lost.</p>
              <div>
                <button
                  type="button"
                  onClick={() => setConfirmingDiscard(false)}
                  autoFocus
                >
                  Keep editing
                </button>
                <button type="button" className="is-danger" onClick={onClose}>
                  Discard
                </button>
              </div>
            </div>
          )}
          <CreateEventPanel
            groupId={groupId}
            titleInputRef={titleInputRef}
            onDirtyChange={handleDirtyChange}
            onCreated={handleCreated}
            onCancel={requestClose}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
