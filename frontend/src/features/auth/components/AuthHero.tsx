import AppIcon, { type AppIconName } from "@/components/layout/AppIcon";
import styles from "./AuthHero.module.css";

interface Benefit {
  icon: AppIconName;
  label: string;
}

interface AuthHeroProps {
  titlePrefix: string;
  titleAccent: string;
  subtitle: string;
  benefits?: Benefit[];
}

export default function AuthHero({
  titlePrefix,
  titleAccent,
  subtitle,
  benefits,
}: AuthHeroProps) {
  return (
    <div className={styles.hero}>
      <h1 className={styles.title}>
        <span className={styles.titlePrefix}>{titlePrefix}</span>{" "}
        <span className={styles.titleAccent}>{titleAccent}</span>
      </h1>

      <p className={styles.subtitle}>{subtitle}</p>

      {benefits && benefits.length > 0 && (
        <ul className={styles.benefits}>
          {benefits.map((benefit) => (
            <li key={benefit.label} className={styles.benefit}>
              <span className={styles.benefitIcon}>
                <AppIcon name={benefit.icon} width={16} height={16} />
              </span>
              {benefit.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
