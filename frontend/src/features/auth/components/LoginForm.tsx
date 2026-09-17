"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiUrl } from "@/lib/api";
import styles from "./LoginForm.module.css";

export default function LoginForm() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch(getApiUrl("/login"), {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        credentials: "include",

        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const next = params.get("next") ?? "/";
      const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

      router.replace(safeNext);
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Welcome back</h1>
        <p className={styles.subheading}>Sign in to your account</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="login-username" className={styles.label}>
            Username or Email
          </label>
          <input
            id="login-username"
            type="text"
            className={styles.control}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-form-error" : undefined}
            autoComplete="username"
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="login-password" className={styles.label}>
            Password
          </label>
          <div className={styles.passwordControl}>
            <input
              id="login-password"
              type={passwordVisible ? "text" : "password"}
              className={styles.control}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "login-form-error" : undefined}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className={styles.visibilityButton}
              aria-pressed={passwordVisible}
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              onClick={() => setPasswordVisible((current) => !current)}
            >
              {passwordVisible ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error && (
          <p id="login-form-error" className={styles.formError} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={styles.btnPrimary} disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <p className={styles.registerLink}>
          New to Social Network? <a href="/register">Create account</a>
        </p>
      </form>
    </div>
  );
}
