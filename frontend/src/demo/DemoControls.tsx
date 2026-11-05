"use client";
import { useState, useSyncExternalStore } from "react";
import AppIcon from "@/components/layout/AppIcon";
import { DEMO_USERS } from "./seed";
import {
  getDemoState,
  getStorageWarning,
  resetDemo,
  switchDemoUser,
} from "./store";
import { DEMO_SOURCE_URL } from "./AboutDemoModal";
import styles from "./DemoControls.module.css";

const subscribe = (fn: () => void) => {
  window.addEventListener("spacial-demo:change", fn);
  return () => window.removeEventListener("spacial-demo:change", fn);
};
export default function DemoControls({ onAbout }: { onAbout: () => void }) {
  const [resetting, setResetting] = useState(false);
  const warning = useSyncExternalStore(subscribe, getStorageWarning, () => "");
  return (
    <div className={styles.controls}>
      <div className={styles.header}>
        <span className={styles.heading}>Demo tools</span>
      </div>
      <label htmlFor="demo-user">Switch account</label>
      <select
        id="demo-user"
        defaultValue={getDemoState().currentUserId}
        onChange={(e) => switchDemoUser(Number(e.target.value))}
      >
        {DEMO_USERS.map((u) => (
          <option key={u.id} value={u.id}>
            {u.first_name} {u.last_name}
            {u.id === 1
              ? " · Observatory creator"
              : u.is_private
                ? " · Private profile"
                : u.id === 2
                  ? " · Code & Coffee creator"
                  : " · Community member"}
          </option>
        ))}
      </select>
      {resetting ? (
        <div className={styles.confirm}>
          <p>Restore all sample data and the default account?</p>
          <div className={styles.confirmActions}>
            <button type="button" onClick={resetDemo}>
              Restore sample data
            </button>
            <button type="button" onClick={() => setResetting(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.action}
          onClick={() => setResetting(true)}
        >
          <AppIcon name="refresh" width={16} height={16} />
          Reset Demo
        </button>
      )}
      <button
        type="button"
        className={styles.action}
        role="menuitem"
        onClick={onAbout}
      >
        <AppIcon name="info" width={16} height={16} />
        About Demo
      </button>
      <a
        className={styles.source}
        href={DEMO_SOURCE_URL}
        target="_blank"
        rel="noreferrer"
      >
        View full-stack source ↗
      </a>
      {warning && <p role="status">{warning}</p>}
    </div>
  );
}
