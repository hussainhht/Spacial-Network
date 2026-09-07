import Link from "next/link";
import type { ReactNode } from "react";
import AppIcon from "@/components/layout/AppIcon";
import styles from "./AuthLayout.module.css";

interface AuthLayoutProps {
  hero: ReactNode;
  cardSize?: "sm" | "lg";
  children: ReactNode;
}

export default function AuthLayout({
  hero,
  cardSize = "sm",
  children,
}: AuthLayoutProps) {
  return (
    <div className={`${styles.shell} space-shell`}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <AppIcon name="planet" width={20} height={20} />
          </span>
          Social Network
        </Link>
      </header>

      <div className={styles.content}>
        <div className={styles.heroSlot}>{hero}</div>

        <div className={styles.cardSlot}>
          <div
            className={`${styles.cardFrame} ${
              cardSize === "lg" ? styles.cardFrameLg : styles.cardFrameSm
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
