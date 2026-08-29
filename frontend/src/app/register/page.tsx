"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState("male");
  const [age, setAge] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: SyntheticEvent<HTMLFormElement>,
  ) {
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

    if (profilePhoto) {
      formData.append("profilePhoto", profilePhoto);
    }

    try {
      const response = await fetch(
        "http://localhost:8080/api/register",
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Registration failed");
        return;
      }

      console.log("Registered:", data);
    } catch {
      setError("Could not connect to the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Create Account</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="firstName">First Name</label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="lastName">Last Name</label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="age">Age</label>
          <input
            id="age"
            type="number"
            min="0"
            max="120"
            value={age}
            onChange={(event) => setAge(event.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="gender">Gender</label>

          <select
            id="gender"
            value={gender}
            onChange={(event) => setGender(event.target.value)}
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>

        <div>
          <label htmlFor="profilePhoto">
            Profile Photo
          </label>

          <input
            id="profilePhoto"
            type="file"
            accept="image/jpeg,image/png,image/gif"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setProfilePhoto(file);
            }}
          />
        </div>

        {error && <p>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Creating account..." : "Register"}
        </button>
        <a href="/login">Already have an account? Login</a>
      </form>
    </main>
  );
}