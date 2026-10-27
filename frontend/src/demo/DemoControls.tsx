"use client";
import { useState, useSyncExternalStore } from "react";
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
      <p>
        This interactive showcase uses simulated local data. The original
        project includes Go, SQLite, and realtime WebSockets. Privacy and
        message delivery are local simulations.
      </p>
      <label htmlFor="demo-user">Switch demo identity</label>
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
      <a
        href="https://github.com/hussainhht/Spacial-Network"
        target="_blank"
        rel="noreferrer"
      >
        View full-stack source ↗
      </a>
      {resetting ? (
        <div>
          <p>
            Restore all sample data and the default identity? Planet preferences
            are kept.
          </p>
          <button type="button" onClick={resetDemo}>
            Restore sample data
          </button>
          <button type="button" onClick={() => setResetting(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setResetting(true)}>
          Reset Demo
        </button>
      )}
      {warning && <p role="status">{warning}</p>}
    </div>
  );
}
