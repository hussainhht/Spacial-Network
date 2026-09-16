import { parseDate } from "@/lib/utils";
import type { Profile } from "../types/profile";
import styles from "./Profile.module.css";

interface ProfileAccountCardProps {
  profile: Profile;
}

export default function ProfileAccountCard({
  profile,
}: ProfileAccountCardProps) {
  const createdDate = parseDate(profile.createdAt);
  const memberSince = createdDate
    ? createdDate.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
  const accountDetails = [
    { label: "Email", value: profile.email },
    { label: "Age", value: profile.age > 0 ? String(profile.age) : "" },
    {
      label: "Gender",
      value: profile.gender
        ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)
        : "",
    },
    { label: "Joined", value: memberSince },
  ].filter((detail) => detail.value);

  if (accountDetails.length === 0) return null;

  return (
    <section className={styles.card} aria-labelledby="account-details-heading">
      <h3 id="account-details-heading" className={styles.cardTitle}>
        <span>Account</span>
      </h3>

      <dl className={styles.infoList}>
        {accountDetails.map((detail) => (
          <div key={detail.label} className={styles.infoRow}>
            <dt className={styles.infoLabel}>{detail.label}</dt>
            <dd className={styles.infoValue}>{detail.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
