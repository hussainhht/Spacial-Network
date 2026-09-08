"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { deleteGroup } from "../api/groups";
import { useGroupAction } from "../hooks/useGroupAction";
import type { Group } from "../types/group";

export default function GroupDangerZone({ group }: { group: Group }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <section
      className="group-panel group-danger-zone"
      aria-labelledby="danger-zone-heading"
    >
      <div className="group-section-heading">
        <h2 id="danger-zone-heading">Danger Zone</h2>
      </div>
      <p className="group-muted">
        Deleting this group permanently removes the group and its related
        data.
      </p>
      <div className="group-danger-zone-actions">
        <button
          type="button"
          className="group-button danger"
          onClick={() => setConfirmOpen(true)}
        >
          Delete Group
        </button>
      </div>
      {confirmOpen && (
        <DeleteGroupDialog
          group={group}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </section>
  );
}

// Mounted only while the confirmation is open (see GroupDangerZone above),
// so the typed-name field naturally starts blank each time without a reset
// effect.
function DeleteGroupDialog({
  group,
  onClose,
}: {
  group: Group;
  onClose: () => void;
}) {
  const router = useRouter();
  const { busy, error, run } = useGroupAction(
    `delete-group:${group.id}`,
    group.id,
  );
  const [typedName, setTypedName] = useState("");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  const isConfirmed = typedName.trim() === group.title.trim();

  async function handleDelete() {
    if (!isConfirmed) return;
    if (await run("Deleting...", () => deleteGroup(group.id))) {
      router.push("/groups");
    }
  }

  return createPortal(
    <div className="group-modal-overlay" onClick={() => !busy && onClose()}>
      <div
        className="group-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-group-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="group-modal-header">
          <h2 id="delete-group-title">Delete &ldquo;{group.title}&rdquo;?</h2>
          <button
            type="button"
            className="group-modal-close"
            aria-label="Cancel"
            disabled={Boolean(busy)}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="group-modal-body">
          <p className="group-muted">
            This action cannot be undone. The group and its related data may
            be permanently removed.
          </p>
          <div className="form-field">
            <label htmlFor="delete-group-confirm">
              Type <strong>{group.title}</strong> to confirm
            </label>
            <input
              id="delete-group-confirm"
              type="text"
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              disabled={Boolean(busy)}
              autoComplete="off"
            />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="group-buttons">
            <button
              type="button"
              className="group-button secondary"
              disabled={Boolean(busy)}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="group-button danger"
              disabled={Boolean(busy) || !isConfirmed}
              onClick={() => void handleDelete()}
            >
              {busy ?? "Delete Group"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
