"use client";

import { useGroupJoinRequest } from "../hooks/useGroupJoinRequest";

interface GroupJoinButtonProps {
  groupId: number;
}

export default function GroupJoinButton({ groupId }: GroupJoinButtonProps) {
  const { status, error, handleRequestToJoin } = useGroupJoinRequest(groupId);

  if (status === "requested") {
    return <p className="group-join-success">Join request sent.</p>;
  }

  return (
    <div className="group-join">
      <button
        type="button"
        onClick={handleRequestToJoin}
        disabled={status === "requesting"}
      >
        {status === "requesting" ? "Requesting..." : "Request to Join"}
      </button>

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
