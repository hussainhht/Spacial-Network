"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { refreshGroupData } from "./useGroupData";

type Mutation = { label: string; promise: Promise<void> };
const mutations = new Map<string, Mutation>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function emit() {
  listeners.forEach((listener) => listener());
}

export function useGroupAction(key: string, groupId: number) {
  const busy = useSyncExternalStore(
    subscribe,
    () => mutations.get(key)?.label ?? null,
    () => null,
  );
  const [error, setError] = useState<string | null>(null);
  
  const run = useCallback(
    async (label: string, action: () => Promise<void>): Promise<boolean> => {
      if (mutations.has(key)) return false;
      setError(null);
      const promise = Promise.resolve().then(action);
      mutations.set(key, { label, promise });
      emit();
      let success = false;
      try {
        await promise;
        success = true;
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Unable to complete this action",
        );
      } finally {
        await refreshGroupData(groupId);
        mutations.delete(key);
        emit();
      }
      return success;
    },
    [key, groupId],
  );
  return { busy, error, run };
}
