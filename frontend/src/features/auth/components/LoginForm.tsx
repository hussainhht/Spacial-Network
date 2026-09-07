"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiUrl } from "@/lib/api";
import PasswordField from "./PasswordField";
import styles from "./AuthForm.module.css";

export default function LoginForm() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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

      router.push("/");
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>
          Log in to your account and continue exploring.
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="username" className={styles.label}>
            Username or Email
          </label>
          <input
            id="username"
            type="text"
            className={styles.input}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />

        {error && (
          <p className={styles.errorBanner} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={styles.submitButton} disabled={loading}>
          {loading ? "Logging in..." : "Log In"}
        </button>
      </form>

      <p className={styles.footer}>
        Don&apos;t have an account?{" "}
        <Link href="/register" className={styles.footerLink}>
          Create one
        </Link>
      </p>
    </>
  );
}
