"use client";
import Link from "next/link";
import styles from "@/features/auth/components/LoginForm.module.css";
export default function DemoEntry() {
  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Spacial Network</h1>
        <p className={styles.subheading}>
          Explore a new dimension of social networking.
        </p>
      </div>
      <p>
        Discover communities, private messaging, interactive profiles, and an
        immersive 3D solar system.
      </p>
      <p>
        Explore with fictional identities and data saved only in this browser.
        No account is needed.
      </p>
      <Link className={styles.btnPrimary} href="/">
        Explore Demo
      </Link>
      <p>
        <a
          href="https://github.com/hussainhht/Spacial-Network"
          target="_blank"
          rel="noreferrer"
        >
          View Source Code ↗
        </a>
      </p>
    </section>
  );
}
