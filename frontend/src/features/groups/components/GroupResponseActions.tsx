"use client";

import {
  acceptGroupInvitation,
  declineGroupInvitation,
  acceptJoinRequest,
  rejectJoinRequest,
} from "../api/groups";
import {
  usePendingInvitations,
  usePendingJoinRequests,
} from "../hooks/useGroupData";
import { useGroupAction } from "../hooks/useGroupAction";

interface Props {
  groupId: number;
  entityId: number;
  onSuccess?: () => void | Promise<void>;
}
interface ControlsProps extends Props {
  kind: "invitation" | "request";
  pending: boolean;
  loading: boolean;
  verificationError: string | null;
  retry: () => Promise<void>;
}
function ResponseControls({
  groupId,
  entityId,
  kind,
  pending,
  loading,
  verificationError,
  retry,
  onSuccess,
}: ControlsProps) {
  const { busy, error, run } = useGroupAction(`${kind}:${entityId}`, groupId);
  async function respond(accept: boolean) {
    const action =
      kind === "invitation"
        ? () =>
            accept
              ? acceptGroupInvitation(entityId)
              : declineGroupInvitation(entityId)
        : () =>
            accept
              ? acceptJoinRequest(groupId, entityId)
              : rejectJoinRequest(groupId, entityId);
    const label = accept
      ? "Accepting…"
      : kind === "invitation"
        ? "Declining…"
        : "Rejecting…";
    if (await run(label, action)) await onSuccess?.();
  }

  return (
    <div
      className="group-response"
      aria-live="polite"
      aria-busy={Boolean(busy) || loading}
    >
      {verificationError ? (
        <div className="group-verification-error">
          <span>Unable to verify: {verificationError}</span>
          <button
            type="button"
            className="group-button secondary"
            onClick={() => void retry()}
          >
            Retry
          </button>
        </div>
      ) : loading && !busy ? (
        <span className="group-muted">Checking status…</span>
      ) : pending || busy ? (
        <div className="group-buttons">
          <button
            type="button"
            className="group-button"
            disabled={Boolean(busy) || loading}
            onClick={() => void respond(true)}
          >
            {busy === "Accepting…" ? busy : "Accept"}
          </button>
          <button
            type="button"
            className="group-button secondary"
            disabled={Boolean(busy) || loading}
            onClick={() => void respond(false)}
          >
            {busy && busy !== "Accepting…"
              ? busy
              : kind === "invitation"
                ? "Decline"
                : "Reject"}
          </button>
        </div>
      ) : (
        <span className="group-muted">No longer pending</span>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function InvitationActions(props: Props) {
  const state = usePendingInvitations();
  return (
    <ResponseControls
      {...props}
      kind="invitation"
      pending={Boolean(
        state.data?.some(
          (i) => i.id === props.entityId && i.groupId === props.groupId,
        ),
      )}
      loading={state.loading}
      verificationError={state.error}
      retry={state.refresh}
    />
  );
}

export function JoinRequestActions(props: Props) {
  const state = usePendingJoinRequests(props.groupId);
  return (
    <ResponseControls
      {...props}
      kind="request"
      pending={Boolean(state.data?.some((r) => r.id === props.entityId))}
      loading={state.loading}
      verificationError={state.error}
      retry={state.refresh}
    />
  );
}
