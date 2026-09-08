"use client";

import { type SubmitEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createGroup, createGroupInvitation } from "../api/groups";
import InviteUserSearch from "./InviteUserSearch";
import SelectedInviteList from "./SelectedInviteList";
import type { Group, InviteCandidate } from "../types/group";

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;
const REDIRECT_DELAY_MS = 1200;

type Step = "details" | "ready" | "invite";

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
  const [photo, setPhoto] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const photoPreview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
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
        photo,
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
    <div className="group-create-card">
      <div className="group-create-steps" aria-hidden="true">
        <span
          className={`group-create-step${step !== "details" ? " is-done" : " is-active"}`}
        >
          <span className="group-create-step-marker">
            {step !== "details" ? "✓" : "1"}
          </span>
          Group Details
        </span>
        <span className="group-create-step-arrow">→</span>
        <span
          className={`group-create-step${step !== "details" ? " is-active" : ""}`}
        >
          <span className="group-create-step-marker">2</span>
          Invite People
        </span>
      </div>

      {step === "details" && (
        <form onSubmit={handleCreateGroup} className="group-form">
          <div className="form-field">
            <label htmlFor="title">Group name</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Photography Club"
              minLength={TITLE_MIN_LENGTH}
              maxLength={TITLE_MAX_LENGTH}
              required
            />
            <p className="group-field-hint">
              Choose a name people will recognize.
            </p>
          </div>

          <div className="form-field">
            <label htmlFor="groupPhoto">Group photo (optional)</label>
            <div className="group-photo-picker">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt=""
                  className="group-photo-preview"
                />
              ) : (
                <span className="group-photo-preview-empty" aria-hidden="true">
                  {trimmedTitle.charAt(0).toUpperCase() || "?"}
                </span>
              )}
              <input
                id="groupPhoto"
                type="file"
                accept="image/jpeg,image/png,image/gif"
                onChange={(event) => {
                  setPhoto(event.target.files?.[0] ?? null);
                }}
              />
            </div>
            <p className="group-field-hint">JPEG, PNG, or GIF. Fully optional.</p>
          </div>

          <div className="form-field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is your group about?"
              maxLength={DESCRIPTION_MAX_LENGTH}
              rows={5}
            />
            <p className="group-field-hint">
              Tell people what this group is about. {remainingDescriptionChars}{" "}
              characters left.
            </p>
          </div>

          {createError && (
            <p className="form-error" role="alert">
              {createError}
            </p>
          )}

          <div className="group-create-actions-bar">
            <Link href="/groups" className="group-button secondary">
              Cancel
            </Link>
            <button type="submit" disabled={creating}>
              {creating ? "Creating your group..." : "Create Group →"}
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
