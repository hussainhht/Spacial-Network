"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SyntheticEvent } from "react";
import { getApiUrl } from "@/lib/api";
import PasswordField from "./PasswordField";
import ProfilePhotoUpload from "./ProfilePhotoUpload";
import styles from "./AuthForm.module.css";

export default function RegisterForm() {
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState("male");
  const [age, setAge] = useState("");
  const [nickname, setNickname] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);

  const router = useRouter();

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const formData = new FormData();

    formData.append("username", username);
    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("gender", gender);
    formData.append("age", age);
    formData.append("about_me", aboutMe);
    formData.append("nickname", nickname);

    if (profilePhoto) {
      formData.append("profilePhoto", profilePhoto);
    }

    try {
      const response = await fetch(getApiUrl("/register"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Registration failed");
        return;
      }

      router.push("/login");
    } catch {
      setError("Could not connect to the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>
          Join the community and start your journey.
        </p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Account Information</h2>

          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="username" className={styles.label}>
                Username
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

            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>
                Email
              </label>
              <input
                id="email"
                type="email"
                className={styles.input}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className={styles.fullWidth}>
              <PasswordField
                id="password"
                label="Password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Personal Information</h2>

          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="firstName" className={styles.label}>
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                className={styles.input}
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="lastName" className={styles.label}>
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                className={styles.input}
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="age" className={styles.label}>
                Age
              </label>
              <input
                id="age"
                type="number"
                min="0"
                max="120"
                className={styles.input}
                value={age}
                onChange={(event) => setAge(event.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="gender" className={styles.label}>
                Gender
              </label>
              <select
                id="gender"
                className={styles.select}
                value={gender}
                onChange={(event) => setGender(event.target.value)}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionLabel}>Profile Details (Optional)</h2>

          <div className={styles.grid}>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label htmlFor="nickname" className={styles.label}>
                Nickname
              </label>
              <input
                id="nickname"
                type="text"
                className={styles.input}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                autoComplete="nickname"
              />
            </div>

            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label htmlFor="aboutMe" className={styles.label}>
                About Me
              </label>
              <textarea
                id="aboutMe"
                className={styles.textarea}
                value={aboutMe}
                onChange={(event) => setAboutMe(event.target.value)}
                placeholder="Tell us a little about yourself..."
                rows={4}
              />
            </div>

            <div className={styles.fullWidth}>
              <ProfilePhotoUpload
                value={profilePhoto}
                onChange={setProfilePhoto}
              />
            </div>
          </div>
        </section>

        {error && (
          <p className={styles.errorBanner} role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className={styles.submitButton}
          disabled={loading}
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <p className={styles.footer}>
        Already have an account?{" "}
        <Link href="/login" className={styles.footerLink}>
          Login
        </Link>
      </p>
    </>
  );
}
