"use client";

import { useMyFollowers } from "../hooks/useMyFollowers";

interface CustomViewerPickerProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

export default function CustomViewerPicker({
  selectedIds,
  onChange,
}: CustomViewerPickerProps) {
  const { followers, loading, error } = useMyFollowers();

  function toggle(id: number) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  if (loading) {
    return <p className="post-visibility-status">Loading your followers...</p>;
  }

  if (error) {
    return <p className="form-error">{error}</p>;
  }

  if (followers.length === 0) {
    return (
      <p className="post-visibility-status">
        You don&apos;t have any followers to choose from yet.
      </p>
    );
  }

  return (
    <fieldset className="post-visibility-picker">
      <legend className="post-visibility-picker-heading">
        Choose who can see this post &middot; {selectedIds.length} selected
      </legend>

      <ul className="post-visibility-picker-list">
        {followers.map((user) => {
          const fullName = [user.firstName, user.lastName]
            .filter(Boolean)
            .join(" ");
          const checked = selectedIds.includes(user.id);

          return (
            <li key={user.id} className="post-visibility-picker-item">
              <label>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(user.id)}
                />
                {fullName || user.username}{" "}
                <span className="post-visibility-picker-username">
                  @{user.username}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
