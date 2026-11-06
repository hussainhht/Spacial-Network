"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  draftSignature,
  draftStorageKey,
  isEmptyDraft,
  readDraft,
  removeDraft,
  writeDraft,
  type DraftValues,
  type PostDraft,
} from "@/features/posts/lib/postDraft";

export type DraftStatus = "idle" | "saving" | "saved" | "error";

const SAVE_DELAY_MS = 700;

/**
 * Debounced localStorage auto-save for the post composer. Saving stays disabled while a
 * recoverable draft is waiting for a decision, so it can never be overwritten implicitly.
 * Call this from a component keyed by user so account switches start from a clean slate.
 */
export function usePostDraft(userId: number, values: DraftValues) {
  const key = draftStorageKey(userId);
  const [recoverable, setRecoverable] = useState<PostDraft | null>(null);
  const [checked, setChecked] = useState(false);
  const [status, setStatus] = useState<DraftStatus>("idle");

  const enabled = checked && !recoverable;
  const valuesRef = useRef(values);
  const enabledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSigRef = useRef<string | null>(null);
  const closedRef = useRef(false);

  useEffect(() => {
    valuesRef.current = values;
    enabledRef.current = enabled;
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const flush = useCallback(() => {
    clearTimer();
    if (closedRef.current || !enabledRef.current) return;
    const current = valuesRef.current;
    if (isEmptyDraft(current)) {
      // Only remove what this session wrote or restored; never wipe a draft we have not shown.
      if (lastSigRef.current !== null) {
        removeDraft(key);
        lastSigRef.current = null;
      }
      setStatus("idle");
      return;
    }
    const sig = draftSignature(current);
    if (sig === lastSigRef.current) {
      setStatus((s) => (s === "saving" ? "saved" : s));
      return;
    }
    if (writeDraft(key, userId, current)) {
      lastSigRef.current = sig;
      setStatus("saved");
    } else {
      setStatus("error");
    }
  }, [clearTimer, key, userId]);

  // Look for an existing draft once per user (the component is remounted on account change).
  useEffect(() => {
    const existing = readDraft(key, userId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecoverable(existing);
    setChecked(true);
  }, [key, userId]);

  const { title, content, visibility, viewerIds, hadImages } = values;
  useEffect(() => {
    if (!enabled || closedRef.current) return;
    const current = { title, content, visibility, viewerIds, hadImages };
    const sig = draftSignature(current);
    if (isEmptyDraft(current) ? lastSigRef.current === null : sig === lastSigRef.current) return;
    setStatus("saving");
    clearTimer();
    timerRef.current = setTimeout(flush, SAVE_DELAY_MS);
    return clearTimer;
  }, [enabled, title, content, visibility, viewerIds, hadImages, clearTimer, flush]);

  // Persist pending edits when the tab is hidden/closed or the form unmounts.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  const accept = useCallback(() => {
    const draft = recoverable;
    if (!draft) return null;
    lastSigRef.current = draftSignature(draft);
    setRecoverable(null);
    setStatus("saved");
    return draft;
  }, [recoverable]);

  const discard = useCallback(() => {
    clearTimer();
    removeDraft(key);
    lastSigRef.current = null;
    setRecoverable(null);
    setStatus("idle");
  }, [clearTimer, key]);

  /** Call only after the server confirmed publication. Blocks any later write. */
  const clearAfterPublish = useCallback(() => {
    closedRef.current = true;
    clearTimer();
    removeDraft(key);
    lastSigRef.current = null;
    setStatus("idle");
  }, [clearTimer, key]);

  return { recoverable, status, accept, discard, clearAfterPublish };
}
