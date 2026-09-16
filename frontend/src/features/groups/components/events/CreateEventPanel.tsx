"use client";

import {
  type FormEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { createGroupEvent } from "../../api/groups";
import { useGroupAction } from "../../hooks/useGroupAction";
import EventCoverPicker from "./EventCoverPicker";

interface CreateEventPanelProps {
  groupId: number;
  titleInputRef: RefObject<HTMLInputElement | null>;
}

interface FieldErrors {
  title?: string;
  date?: string;
  time?: string;
}

const TITLE_MAX_LENGTH = 500;
const DESCRIPTION_MAX_LENGTH = 500;

function localToday(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toEventTimeISOString(date: string, time: string): string | null {
  if (!date || !time) return null;
  const local = new Date(`${date}T${time}`);
  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
}

export default function CreateEventPanel({
  groupId,
  titleInputRef,
}: CreateEventPanelProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const { busy, error, run } = useGroupAction(
    `create-event:${groupId}`,
    groupId,
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (error) errorSummaryRef.current?.focus();
  }, [error]);

  function clearFieldError(field: keyof FieldErrors) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSuccess("");
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setDate("");
    setTime("");
    setImage(null);
    setSelectedTemplate(null);
    setFieldErrors({});
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const errors: FieldErrors = {};
    const trimmedTitle = title.trim();
    if (!trimmedTitle) errors.title = "Enter an event title.";
    if (!date) errors.date = "Choose an event date.";
    if (!time) errors.time = "Choose an event time.";

    const eventTime = toEventTimeISOString(date, time);
    if (date && time && !eventTime) {
      errors.date = "Enter a valid event date.";
    } else if (eventTime && new Date(eventTime).getTime() <= Date.now()) {
      errors.date = "Choose a date and time in the future.";
    }

    setFieldErrors(errors);
    setSuccess("");
    if (Object.keys(errors).length > 0 || !eventTime) {
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>("[aria-invalid='true']")
          ?.focus();
      });
      return;
    }

    const ok = await run("Creating event…", () =>
      createGroupEvent(groupId, {
        title: trimmedTitle,
        description: description.trim(),
        eventTime,
        image,
        coverTemplate: selectedTemplate,
      }),
    );
    if (ok) {
      resetForm();
      setSuccess(`“${trimmedTitle}” was created and added to the event list.`);
    }
  }

  return (
    <aside
      id="create-event-panel"
      className="group-create-event-panel"
      aria-labelledby="create-event-heading"
    >
      <div className="group-create-event-heading">
        <p className="group-eyebrow">New gathering</p>
        <h3 id="create-event-heading">Create event</h3>
        <p>Share a moment for your group to look forward to.</p>
      </div>

      <form
        ref={formRef}
        className="group-form group-event-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <EventCoverPicker
          selectedTemplate={selectedTemplate}
          image={image}
          onTemplateChange={setSelectedTemplate}
          onImageChange={setImage}
        />

        <div className="form-field">
          <label htmlFor="event-title">
            Title <span aria-hidden="true">*</span>
          </label>
          <input
            ref={titleInputRef}
            id="event-title"
            type="text"
            value={title}
            maxLength={TITLE_MAX_LENGTH}
            required
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={
              fieldErrors.title ? "event-title-error" : "event-title-help"
            }
            onChange={(event) => {
              setTitle(event.target.value);
              clearFieldError("title");
            }}
          />
          <span id="event-title-help" className="event-field-help">
            {title.length}/{TITLE_MAX_LENGTH}
          </span>
          {fieldErrors.title && (
            <p id="event-title-error" className="event-field-error">
              {fieldErrors.title}
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="event-description">
            Description <span className="event-optional">(optional)</span>
          </label>
          <textarea
            id="event-description"
            value={description}
            maxLength={DESCRIPTION_MAX_LENGTH}
            rows={4}
            onChange={(event) => {
              setDescription(event.target.value);
              setSuccess("");
            }}
          />
          <span className="event-field-help">
            {description.length}/{DESCRIPTION_MAX_LENGTH}
          </span>
        </div>

        <div className="group-event-datetime-row">
          <div className="form-field">
            <label htmlFor="event-date">
              Date <span aria-hidden="true">*</span>
            </label>
            <input
              id="event-date"
              type="date"
              value={date}
              min={localToday()}
              required
              aria-invalid={Boolean(fieldErrors.date)}
              aria-describedby={
                fieldErrors.date ? "event-date-error" : undefined
              }
              onChange={(event) => {
                setDate(event.target.value);
                clearFieldError("date");
              }}
            />
            {fieldErrors.date && (
              <p id="event-date-error" className="event-field-error">
                {fieldErrors.date}
              </p>
            )}
          </div>
          <div className="form-field">
            <label htmlFor="event-time">
              Time <span aria-hidden="true">*</span>
            </label>
            <input
              id="event-time"
              type="time"
              value={time}
              required
              aria-invalid={Boolean(fieldErrors.time)}
              aria-describedby={
                fieldErrors.time ? "event-time-error" : undefined
              }
              onChange={(event) => {
                setTime(event.target.value);
                clearFieldError("time");
              }}
            />
            {fieldErrors.time && (
              <p id="event-time-error" className="event-field-error">
                {fieldErrors.time}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div
            ref={errorSummaryRef}
            className="form-error"
            role="alert"
            tabIndex={-1}
          >
            {error}
          </div>
        )}
        {success && (
          <p className="form-success" role="status">
            {success}
          </p>
        )}

        <button type="submit" disabled={Boolean(busy)}>
          {busy ?? "Create event"}
        </button>
      </form>
    </aside>
  );
}
