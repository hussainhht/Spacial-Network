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
import styles from "./DemoControls.module.css";

const subscribe = (fn: () => void) => {
  window.addEventListener("spacial-demo:change", fn);
  return () => window.removeEventListener("spacial-demo:change", fn);
};
export default function DemoControls() {
  const [resetting, setResetting] = useState(false);
  const warning = useSyncExternalStore(subscribe, getStorageWarning, () => "");
  return (
    <div className={styles.controls}>
      <div className={styles.header}>
        <span className={styles.badge}>Demo Mode</span>
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
      <details className={styles.about}>
        <summary>About Demo</summary>
        <p>
          Simulated local data. The full app runs on Go, SQLite and realtime
          WebSockets.
        </p>
        <a
          href="https://github.com/hussainhht/Spacial-Network"
          target="_blank"
          rel="noreferrer"
        >
          View full-stack source ↗
        </a>
      </details>
      {warning && <p role="status">{warning}</p>}
    </div>
  );
}
