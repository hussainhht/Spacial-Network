"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getGroup,
  getGroupMembers,
  getMembership,
  getPendingInvitations,
  getPendingJoinRequests,
} from "../api/groups";

type Snapshot<T> = {
  data: T | undefined;
  loading: boolean;
  error: string | null;
};
interface Resource<T> {
  snapshot: Snapshot<T>;
  listeners: Set<() => void>;
  subscribe: (listener: () => void) => () => void;
  read: () => Snapshot<T>;
  reload: () => Promise<void>;
}

const resources = new Map<string, Resource<unknown>>();
const empty = { data: undefined, loading: true, error: null };
function resourceFor<T>(key: string, fetcher: () => Promise<T>): Resource<T> {
  const existing = resources.get(key);
  if (existing) return existing as Resource<T>;
  let revision = 0;
  const emit = () => resource.listeners.forEach((listener) => listener());
  const resource: Resource<T> = {
    snapshot: empty,
    listeners: new Set(),
    read: () => resource.snapshot,
    subscribe(listener) {
      resource.listeners.add(listener);
      resources.set(key, resource as Resource<unknown>);
      if (resource.listeners.size === 1) void resource.reload();
      return () => {
        resource.listeners.delete(listener);
        if (!resource.listeners.size) {
          revision++;
          resource.snapshot = empty;
          if (resources.get(key) === resource) resources.delete(key);
        }
      };
    },
    async reload() {
      const current = ++revision;
      resource.snapshot = { ...resource.snapshot, loading: true, error: null };
      emit();
      try {
        const data = await fetcher();
        if (current === revision)
          resource.snapshot = { data, loading: false, error: null };
      } catch (error) {
        if (current === revision)
          resource.snapshot = {
            ...resource.snapshot,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to load group data",
          };
      }
      if (current === revision) emit();
    },
  };
  resources.set(key, resource as Resource<unknown>);
  return resource;
}
export function useGroupQuery<T>(key: string, fetcher: () => Promise<T>) {
  // The key fully identifies the request; callers may supply inline fetchers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resource = useMemo(() => resourceFor(key, fetcher), [key]);
  const state = useSyncExternalStore(
    resource.subscribe,
    resource.read,
    () => empty,
  );
  return { ...state, refresh: resource.reload };
}
export async function refreshGroupData(groupId?: number): Promise<void> {
  const requests = [...resources.entries()]
    .filter(
      ([key, resource]) =>
        resource.listeners.size &&
        (groupId === undefined ||
          key === "invitations" ||
          key.startsWith("groups:") ||
          key.startsWith(`group:${groupId}:`)),
    )
    .map(([, resource]) => resource.reload());
  await Promise.all(requests);
}
export const useGroup = (id: number) =>
  useGroupQuery(`group:${id}:details`, () => getGroup(id));
export const useGroupMembers = (id: number) =>
  useGroupQuery(`group:${id}:members`, () => getGroupMembers(id));
export const useMembership = (id: number) =>
  useGroupQuery(`group:${id}:membership`, () => getMembership(id));
export const usePendingInvitations = () =>
  useGroupQuery("invitations", getPendingInvitations);
export const usePendingJoinRequests = (id: number) =>
  useGroupQuery(`group:${id}:requests`, () => getPendingJoinRequests(id));
