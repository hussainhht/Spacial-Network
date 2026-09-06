"use client";
import { useGroupJoinRequest } from "../hooks/useGroupJoinRequest";
export default function GroupJoinButton({ groupId }: { groupId: number }) {
  const { pending, busy, error, disabled, handleRequestToJoin } =
    useGroupJoinRequest(groupId);
  return (
    <div className="group-join" aria-live="polite">
      <button
        type="button"
        className="group-button"
        onClick={handleRequestToJoin}
        disabled={disabled}
      >
        {busy ?? (pending ? "Request Pending" : "Request to Join")}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
