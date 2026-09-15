"use client";

import Link from "next/link";
import { type SubmitEvent, useEffect, useMemo, useState } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { avatarUrl, updateGroup } from "../../api/groups";
import { useGroupAction } from "../../hooks/useGroupAction";
import type { Group } from "../../types/group";
import GroupCard from "../GroupCard";
import { JoinRequestsPanel, MembersPanel } from "../GroupPanels";
import GroupDangerZone from "./GroupDangerZone";
import styles from "./GroupSettings.module.css";

const TITLE_MIN_LENGTH = 3;
const TITLE_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;

type SettingsSection = "general" | "members" | "danger";

export default function EditGroupForm({ group }: { group: Group }) {
  const { busy, error, run } = useGroupAction(`edit-group:${group.id}`, group.id);
  const [title, setTitle] = useState(group.title);
  const [description, setDescription] = useState(group.description);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState<SettingsSection>("general");

  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const trimmedTitle = title.trim();
  const titleValid = trimmedTitle.length >= TITLE_MIN_LENGTH;
  const currentPhotoUrl = removePhoto ? undefined : avatarUrl(group.groupPhoto);
  const displayedPhoto = photoPreview ?? currentPhotoUrl;
  const hasChanges = title !== group.title || description !== group.description || photo !== null || removePhoto;
  const previewGroup: Group = {
    ...group,
    title: trimmedTitle || group.title,
    description,
    groupPhoto: removePhoto ? undefined : group.groupPhoto,
  };

  function markChanged() { setSaved(false); }
  function resetForm() {
    setTitle(group.title);
    setDescription(group.description);
    setPhoto(null);
    setRemovePhoto(false);
    setSaved(false);
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !titleValid || !hasChanges) return;
    setSaved(false);
    const success = await run("Saving…", () => updateGroup(group.id, {
      title: trimmedTitle,
      description: description.trim(),
      photo,
      removePhoto,
    }).then(() => undefined));
    if (success) {
      setTitle(trimmedTitle);
      setDescription(description.trim());
      setPhoto(null);
      setRemovePhoto(false);
      setSaved(true);
    }
  }

  return <div className={styles.settings}>
    <header className={styles.header}>
      <div>
        <Link href={`/groups/${group.id}`} className={styles.back}>
          <AppIcon name="arrowLeft" width={15} height={15} /> Back to Group
        </Link>
        <h1>Group Settings</h1>
        <p>Manage your group details, members and settings.</p>
      </div>
      <Link href={`/groups/${group.id}`} className="group-button secondary">View Group</Link>
    </header>

    <div className={styles.workspace}>
      <nav className={styles.nav} aria-label="Group settings sections">
        <button type="button" onClick={() => setSection("general")} aria-current={section === "general" ? "page" : undefined}><AppIcon name="settings" width={17} height={17} /> General</button>
        <button type="button" onClick={() => setSection("members")} aria-current={section === "members" ? "page" : undefined}><AppIcon name="groups" width={17} height={17} /> Members</button>
        <button type="button" onClick={() => setSection("danger")} aria-current={section === "danger" ? "page" : undefined}><AppIcon name="warning" width={17} height={17} /> Danger Zone</button>
      </nav>

      <div className={styles.content}>
        {section === "general" && <>
          {group.privacy === "public" && <JoinRequestsPanel groupId={group.id} compact />}
          <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.grid}>
        <section id="group-settings-general" className={`group-panel ${styles.information}`} aria-labelledby="edit-group-heading">
          <div className={styles.sectionHeading}>
            <h2 id="edit-group-heading">Group Information</h2>
            <p>Update your group&apos;s basic details and appearance.</p>
          </div>

          <div className={styles.field}>
            <label>Group photo</label>
            <div className={styles.photoControl}>
              {displayedPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element -- may be a local blob preview
                <img src={displayedPhoto} alt="Current group" />
              ) : <span aria-hidden="true">{trimmedTitle.charAt(0).toUpperCase() || "?"}</span>}
              <div>
                <div className="group-buttons">
                  <label className="group-button secondary" htmlFor="edit-group-photo">Change Photo</label>
                  <input id="edit-group-photo" type="file" accept="image/jpeg,image/png,image/gif" className="sr-only" disabled={Boolean(busy)} onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file) { setPhoto(file); setRemovePhoto(false); markChanged(); }
                    event.target.value = "";
                  }} />
                  {displayedPhoto && <button type="button" className={styles.removePhoto} disabled={Boolean(busy)} onClick={() => { setPhoto(null); setRemovePhoto(true); markChanged(); }}>Remove</button>}
                </div>
                <small>JPEG, PNG or GIF · up to 5 MB</small>
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}><label htmlFor="edit-group-title">Group name</label><span>{title.length}/{TITLE_MAX_LENGTH}</span></div>
            <input id="edit-group-title" type="text" value={title} onChange={(event) => { setTitle(event.target.value); markChanged(); }} minLength={TITLE_MIN_LENGTH} maxLength={TITLE_MAX_LENGTH} disabled={Boolean(busy)} required />
            {!titleValid && title.length > 0 && <small className={styles.validation}>Group name must be at least {TITLE_MIN_LENGTH} characters.</small>}
          </div>

          <div className={styles.field}>
            <div className={styles.labelRow}><label htmlFor="edit-group-description">Description</label><span>{DESCRIPTION_MAX_LENGTH - description.length} left</span></div>
            <textarea id="edit-group-description" value={description} onChange={(event) => { setDescription(event.target.value); markChanged(); }} maxLength={DESCRIPTION_MAX_LENGTH} rows={6} disabled={Boolean(busy)} />
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          {saved && !error && <p className="form-success" role="status">Group updated successfully.</p>}
        </section>

        <aside className={styles.preview} aria-labelledby="group-preview-heading">
          <div className={styles.previewHeading}><h2 id="group-preview-heading">Preview</h2><p>This is how your group will appear to users.</p></div>
          <GroupCard group={previewGroup} interactive={false} photoUrlOverride={removePhoto ? null : photoPreview ?? undefined} />
        </aside>
      </div>

      <footer className={styles.actions}>
        <button type="button" className="group-button secondary" onClick={resetForm} disabled={Boolean(busy) || !hasChanges}>Cancel</button>
        <button type="submit" className="group-button" disabled={Boolean(busy) || !titleValid || !hasChanges}>{busy ?? "Save Changes"}</button>
      </footer>
          </form>
        </>}
        {section === "members" && <MembersPanel groupId={group.id} creatorId={group.creatorId} />}
        {section === "danger" && <GroupDangerZone group={group} />}
      </div>
    </div>
  </div>;
}
