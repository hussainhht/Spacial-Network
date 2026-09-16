"use client";

import { type SubmitEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppIcon from "@/components/layout/AppIcon";

import { createGroup, createGroupInvitation } from "../../api/groups";
import {
  GROUP_IMAGE_TEMPLATES,
  type GroupImageTemplate,
} from "../../constants/groupImageTemplates";
import GroupPrivacyBadge from "../GroupPrivacyBadge";
import InviteUserSearch from "./InviteUserSearch";
import SelectedInviteList from "./SelectedInviteList";
import type {
  Group,
  GroupPrivacy,
  InviteCandidate,
} from "../../types/group";
import styles from "./CreateGroupForm.module.css";

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;
const REDIRECT_DELAY_MS = 1200;
const MAX_GROUP_PHOTO_SIZE = 5 * 1024 * 1024;
const GROUP_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/gif"]);

type Step = "details" | "ready" | "invite";
type PhotoMode = "upload" | "template";
type GroupPhotoSource =
  | { type: "upload"; file: File }
  | { type: "template"; template: GroupImageTemplate }
  | null;

interface InviteResult {
  total: number;
  sent: number;
  failed: number;
}

function inviteResultTitle({ sent }: InviteResult): string {
  return sent > 0 ? "Invitations sent" : "Group created";
}

function inviteResultDetail({ total, sent, failed }: InviteResult): string {
  if (failed === 0)
    return `${sent} ${sent === 1 ? "invitation" : "invitations"} sent.`;
  if (sent === 0) return "Group created, but invitations could not be sent.";
  return `Group created. ${sent} of ${total} invitations were sent.`;
}

export default function CreateGroupForm() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("details");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photoMode, setPhotoMode] = useState<PhotoMode>("upload");
  const [photoSource, setPhotoSource] = useState<GroupPhotoSource>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<GroupPrivacy>("private");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const uploadedPhoto =
    photoSource?.type === "upload" ? photoSource.file : null;
  const photoPreview = useMemo(
    () => (uploadedPhoto ? URL.createObjectURL(uploadedPhoto) : null),
    [uploadedPhoto],
  );
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  // Set exactly once, by the explicit "Create Group" submit below. Nothing
  // else in this component is allowed to create a group.
  const [createdGroup, setCreatedGroup] = useState<Group | null>(null);

  const [selectedInvites, setSelectedInvites] = useState<InviteCandidate[]>([]);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);

  const trimmedTitle = title.trim();
  const titleValid = trimmedTitle.length >= TITLE_MIN_LENGTH;
  const remainingDescriptionChars = DESCRIPTION_MAX_LENGTH - description.length;

  async function handleCreateGroup(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;

    if (!titleValid) {
      setCreateError(
        `Group name must be at least ${TITLE_MIN_LENGTH} characters.`,
      );
      return;
    }

    setCreateError(null);
    setCreating(true);

    try {
      const group = await createGroup({
        title: trimmedTitle,
        description: description.trim(),
        privacy,
        photo: photoSource?.type === "upload" ? photoSource.file : null,
        imageTemplateId:
          photoSource?.type === "template" ? photoSource.template.id : null,
      });
      setCreatedGroup(group);
      setStep("ready");
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create group",
      );
    } finally {
      setCreating(false);
    }
  }

  function handlePhotoSelection(file: File | null): boolean {
    setPhotoError(null);
    if (!file) {
      return true;
    }
    if (!GROUP_PHOTO_TYPES.has(file.type)) {
      setPhotoError("Choose a JPEG, PNG, or GIF image.");
      return false;
    }
    if (file.size > MAX_GROUP_PHOTO_SIZE) {
      setPhotoError("Group photo must be 5 MB or smaller.");
      return false;
    }
    setPhotoSource({ type: "upload", file });
    return true;
  }

  function clearPhoto() {
    setPhotoError(null);
    setPhotoSource(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function selectTemplate(template: GroupImageTemplate) {
    setPhotoError(null);
    setPhotoSource({ type: "template", template });
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function selectInvite(user: InviteCandidate) {
    setSelectedInvites((prev) =>
      prev.some((u) => u.id === user.id) ? prev : [...prev, user],
    );
  }

  function removeInvite(userId: number) {
    setSelectedInvites((prev) => prev.filter((u) => u.id !== userId));
  }

  function goToGroup(group: Group) {
    router.push(`/groups/${group.id}`);
  }

  async function handleSendInvitations() {
    if (!createdGroup || selectedInvites.length === 0 || sendingInvites) return;

    setSendingInvites(true);
    const results = await Promise.allSettled(
      selectedInvites.map((user) =>
        createGroupInvitation(createdGroup.id, user.id),
      ),
    );
    const failed = results.filter(
      (result) => result.status === "rejected",
    ).length;
    const sent = results.length - failed;

    setSendingInvites(false);
    setInviteResult({ total: results.length, sent, failed });

    setTimeout(() => goToGroup(createdGroup), REDIRECT_DELAY_MS);
  }

  return (
    <div className={styles.card}>
      <div className={styles.steps} aria-label="Group creation progress">
        <span
          className={`${styles.step} ${
            step !== "details" ? styles.stepDone : styles.stepActive
          }`}
          aria-current={step === "details" ? "step" : undefined}
        >
          <span className={styles.stepMarker} aria-hidden="true">
            {step !== "details" ? "✓" : "1"}
          </span>
          <span>Group Details</span>
        </span>
        <span className={styles.stepRail} aria-hidden="true" />
        <span
          className={`${styles.step} ${
            step !== "details" ? styles.stepActive : ""
          }`}
          aria-current={step !== "details" ? "step" : undefined}
        >
          <span className={styles.stepMarker} aria-hidden="true">2</span>
          <span>Invite People</span>
        </span>
      </div>

      {step === "details" && (
        <form onSubmit={handleCreateGroup} className={styles.form}>
          <div className={styles.workspace}>
            <div className={styles.fields}>
              <div className={styles.field}>
                <label htmlFor="title" className={styles.label}>
                  Group name
                </label>
                <input
                  id="title"
                  className={styles.textInput}
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Give your community a name"
                  minLength={TITLE_MIN_LENGTH}
                  maxLength={TITLE_MAX_LENGTH}
                  autoComplete="off"
                  required
                />
                <p className={styles.hint} id="title-hint">
                  Choose something clear and easy to recognize.
                </p>
              </div>

              <div className={styles.field}>
                <span className={styles.label}>Group photo</span>
                <div
                  className={styles.photoModes}
                  role="group"
                  aria-label="Group photo source"
                >
                  <button
                    type="button"
                    className={photoMode === "upload" ? styles.photoModeActive : ""}
                    aria-pressed={photoMode === "upload"}
                    aria-controls="group-photo-upload-panel"
                    onClick={() => setPhotoMode("upload")}
                  >
                    Upload image
                  </button>
                  <button
                    type="button"
                    className={photoMode === "template" ? styles.photoModeActive : ""}
                    aria-pressed={photoMode === "template"}
                    aria-controls="group-photo-template-panel"
                    onClick={() => setPhotoMode("template")}
                  >
                    Choose template
                  </button>
                </div>

                {photoMode === "upload" ? (
                  <div
                    id="group-photo-upload-panel"
                    className={styles.photoPanel}
                  >
                    <div className={styles.photoRow}>
                      <label htmlFor="groupPhoto" className={styles.photoPicker}>
                        <span className={styles.photoIcon} aria-hidden="true">
                          <AppIcon name="image" width={22} height={22} />
                        </span>
                        <span>
                          <strong>
                            {photoSource?.type === "upload"
                              ? "Choose a different image"
                              : "Upload an image"}
                          </strong>
                          <small>JPEG, PNG or GIF · up to 5 MB</small>
                        </span>
                      </label>
                      <input
                        id="groupPhoto"
                        ref={photoInputRef}
                        className={styles.fileInput}
                        type="file"
                        accept="image/jpeg,image/png,image/gif"
                        aria-describedby={
                          photoError ? "group-photo-error" : undefined
                        }
                        onChange={(event) => {
                          if (
                            !handlePhotoSelection(
                              event.target.files?.[0] ?? null,
                            )
                          ) {
                            event.target.value = "";
                          }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    id="group-photo-template-panel"
                    className={styles.photoPanel}
                  >
                    <p className={styles.templateHeading}>Choose a template</p>
                    <div className={styles.templateGrid}>
                      {GROUP_IMAGE_TEMPLATES.map((template) => {
                        const selected =
                          photoSource?.type === "template" &&
                          photoSource.template.id === template.id;
                        return (
                          <button
                            key={template.id}
                            type="button"
                            className={`${styles.templateCard} ${
                              selected ? styles.templateCardSelected : ""
                            }`}
                            aria-pressed={selected}
                            onClick={() => selectTemplate(template)}
                          >
                            <Image
                              src={template.src}
                              alt={`${template.label} group photo template`}
                              width={240}
                              height={150}
                              sizes="(max-width: 700px) 42vw, (max-width: 1000px) 20vw, 130px"
                            />
                            <span className={styles.templateLabel}>
                              {template.label}
                            </span>
                            {selected && (
                              <span
                                className={styles.templateCheck}
                                aria-hidden="true"
                              >
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {photoSource && (
                  <div className={styles.photoSelection}>
                    <span role="status">
                      {photoSource.type === "upload"
                        ? photoSource.file.name
                        : `${photoSource.template.label} template selected`}
                    </span>
                    <button
                      type="button"
                      className={styles.removePhoto}
                      onClick={clearPhoto}
                    >
                      Remove image
                    </button>
                  </div>
                )}
                {photoError && (
                  <p id="group-photo-error" className={styles.fieldError} role="alert">
                    {photoError}
                  </p>
                )}
              </div>

              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label htmlFor="description" className={styles.label}>
                    Description
                  </label>
                  <span>{remainingDescriptionChars}</span>
                </div>
                <textarea
                  id="description"
                  className={styles.textarea}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What will bring this group together?"
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  rows={5}
                />
                <p className={styles.hint}>
                  Help people understand what they’ll find here.
                </p>
              </div>

              <fieldset className={styles.privacyFieldset}>
                <legend className={styles.label}>Privacy</legend>
                <div className={styles.privacyOptions}>
                  {(
                    [
                      {
                        value: "public",
                        title: "Public",
                        detail:
                          "Discoverable. Anyone can request to join; membership requires approval.",
                        icon: "globe",
                      },
                      {
                        value: "private",
                        title: "Private",
                        detail:
                          "Hidden from discovery. People join only by invitation from the creator.",
                        icon: "lock",
                      },
                    ] as const
                  ).map((option) => (
                    <label key={option.value} className={styles.privacyOption}>
                      <input
                        type="radio"
                        name="privacy"
                        value={option.value}
                        checked={privacy === option.value}
                        onChange={() => setPrivacy(option.value)}
                      />
                      <span className={styles.privacyOptionContent}>
                        <span className={styles.privacyOptionIcon} aria-hidden="true">
                          <AppIcon name={option.icon} width={20} height={20} />
                        </span>
                        <span>
                          <strong>{option.title}</strong>
                          <small>{option.detail}</small>
                        </span>
                        <span className={styles.radioIndicator} aria-hidden="true" />
                      </span>
                    </label>
                  ))}
                </div>
                <p className={styles.hint}>
                  Posts, events, and chat stay visible to members only.
                </p>
              </fieldset>
            </div>

            <aside className={styles.preview} aria-labelledby="live-preview-title">
              <div className={styles.previewHeading}>
                <span className={styles.liveDot} aria-hidden="true" />
                <h2 id="live-preview-title">Live preview</h2>
              </div>
              <div className={styles.previewCard}>
                <div className={styles.previewCover}>
                  {photoSource?.type === "template" ? (
                    <Image
                      src={photoSource.template.src}
                      alt={`${photoSource.template.label} group photo preview`}
                      fill
                      sizes="(max-width: 700px) 100vw, 36vw"
                    />
                  ) : photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="Uploaded group photo preview" />
                  ) : (
                    <div className={styles.previewPlaceholder} aria-hidden="true">
                      <span>{trimmedTitle.charAt(0).toUpperCase() || "✦"}</span>
                      <AppIcon name="image" width={24} height={24} />
                    </div>
                  )}
                </div>
                <div className={styles.previewBody}>
                  <p className={styles.previewEyebrow}>New community</p>
                  <h3>{trimmedTitle || "Your Group Name"}</h3>
                  <GroupPrivacyBadge privacy={privacy} detailed />
                  <p className={styles.previewPrivacyDetail}>
                    {privacy === "public"
                      ? "Discoverable · Join requests require approval"
                      : "Invite only · Hidden from discovery"}
                  </p>
                  <p className={styles.previewDescription}>
                    {description.trim() ||
                      "Your group description will appear here as you type."}
                  </p>
                  <div className={styles.previewMeta} aria-hidden="true">
                    <span className={styles.previewAvatars}>✦</span>
                    <span>You’ll be the first member</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          {createError && (
            <p className="form-error" role="alert">
              {createError}
            </p>
          )}

          <div className={styles.actions}>
            <Link href="/groups" className="group-button secondary">
              Cancel
            </Link>
            <button type="submit" className="group-button" disabled={creating}>
              {creating ? "Creating your group…" : "Create Group"}
              {!creating && <AppIcon name="arrow" width={17} height={17} />}
            </button>
          </div>
        </form>
      )}

      {step === "ready" && createdGroup && (
        <div className="group-create-ready">
          <span className="group-create-success-icon" aria-hidden="true">
            ✓
          </span>
          <h2>Your group is ready</h2>
          <p className="group-muted">
            “{createdGroup.title}” has been created. Would you like to invite
            people now?
          </p>
          <div className="group-create-buttons">
            <button
              type="button"
              className="group-button secondary"
              onClick={() => goToGroup(createdGroup)}
            >
              Skip for now
            </button>
            <button type="button" onClick={() => setStep("invite")}>
              Invite People
            </button>
          </div>
        </div>
      )}

      {step === "invite" && createdGroup && (
        <div className="group-create-invite-step">
          {inviteResult ? (
            <div className="group-create-success" role="status">
              <span className="group-create-success-icon" aria-hidden="true">
                ✓
              </span>
              <div>
                <p className="group-create-success-title">
                  {inviteResultTitle(inviteResult)}
                </p>
                <p className="group-create-success-detail">
                  {inviteResultDetail(inviteResult)}
                </p>
                <p className="group-create-success-redirect">
                  Taking you to your group…
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="group-section-heading">
                <h2>Invite people</h2>
              </div>
              <p className="group-section-subtext">
                Search for people to join “{createdGroup.title}”.
              </p>

              <InviteUserSearch
                groupId={createdGroup.id}
                autoFocus
                renderAction={(user) => {
                  const selected = selectedInvites.some(
                    (u) => u.id === user.id,
                  );
                  return (
                    <button
                      type="button"
                      className={`group-invite-action-btn${selected ? " is-selected" : ""}`}
                      onClick={() => selectInvite(user)}
                      disabled={selected}
                    >
                      {selected ? "✓ Selected" : "+ Add"}
                    </button>
                  );
                }}
              />

              {selectedInvites.length > 0 ? (
                <SelectedInviteList
                  users={selectedInvites}
                  onRemove={removeInvite}
                  disabled={sendingInvites}
                />
              ) : (
                <p className="group-invite-status">No people selected yet.</p>
              )}

              <div className="group-create-actions-bar">
                <button
                  type="button"
                  className="group-button secondary"
                  onClick={() => goToGroup(createdGroup)}
                  disabled={sendingInvites}
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={handleSendInvitations}
                  disabled={sendingInvites || selectedInvites.length === 0}
                >
                  {sendingInvites
                    ? "Sending invitations..."
                    : "Send Invitations"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
