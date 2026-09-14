"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createGroupEvent } from "../../api/groups";
import { useGroupAction } from "../../hooks/useGroupAction";

interface CreateEventModalProps {
  groupId: number;
  onClose: () => void;
}

const TITLE_MAX_LENGTH = 500;
const DESCRIPTION_MAX_LENGTH = 500;

// Combines separate date/time inputs (interpreted as the browser's local
// time, per the Date constructor's handling of a timezone-less ISO string)
// into the RFC3339 UTC timestamp the backend's ValidateEventTime expects.
function toEventTimeISOString(date: string, time: string): string | null {
  if (!date || !time) return null;
  const local = new Date(`${date}T${time}`);
  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
}

// Mounted only while open (see GroupEvents), so each opening is a fresh
// instance — form fields naturally start blank without a reset effect.
export default function CreateEventModal({
  groupId,
  onClose,
}: CreateEventModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const { busy, error, run } = useGroupAction(
    `create-event:${groupId}`,
    groupId,
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const scrollContainer = document.getElementById("page-content");
    const previousOverflow = scrollContainer?.style.overflow ?? "";
    if (scrollContainer) scrollContainer.style.overflow = "hidden";

    return () => {
      if (scrollContainer) scrollContainer.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError("Title cannot be empty.");
      return;
    }
    if (!date || !time) {
      setFormError("Date and time are required.");
      return;
    }
    const eventTime = toEventTimeISOString(date, time);
    if (!eventTime) {
      setFormError("Enter a valid date and time.");
      return;
    }
    // UX-only guard — the backend re-validates event_time against its own
    // clock and is the authoritative check (see ValidateEventTime/CreateEvent
    // in backend/internal/groups).
    if (new Date(eventTime).getTime() <= Date.now()) {
      setFormError("Event time must be in the future.");
      return;
    }

    setFormError(null);
    const ok = await run("Creating…", () =>
      createGroupEvent(groupId, {
        title: trimmedTitle,
        description: description.trim(),
        eventTime,
      }),
    );
    if (ok) onClose();
  }

  return createPortal(
    <div className="group-modal-overlay" onClick={onClose}>
      <div
        className="group-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-event-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="group-modal-header">
          <h2 id="create-event-modal-title">Create Event</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="group-modal-close"
            aria-label="Close create event dialog"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="group-modal-body">
          <form onSubmit={handleSubmit} className="group-form">
            <div className="form-field">
              <label htmlFor="event-title">Title</label>
              <input
                id="event-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={TITLE_MAX_LENGTH}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="event-description">Description</label>
              <textarea
                id="event-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={DESCRIPTION_MAX_LENGTH}
                rows={4}
              />
            </div>

            <div className="group-event-datetime-row">
              <div className="form-field">
                <label htmlFor="event-date">Date</label>
                <input
                  id="event-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="event-time">Time</label>
                <input
                  id="event-time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  required
                />
              </div>
            </div>

            {(formError || error) && (
              <p className="form-error" role="alert">
                {formError ?? error}
              </p>
            )}

            <div className="group-create-actions-bar">
              <button
                type="button"
                className="group-button secondary"
                onClick={onClose}
                disabled={Boolean(busy)}
              >
                Cancel
              </button>
              <button type="submit" disabled={Boolean(busy)}>
                {busy ?? "Create Event"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
