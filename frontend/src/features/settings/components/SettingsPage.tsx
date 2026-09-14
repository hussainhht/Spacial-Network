import styles from "./SettingsPage.module.css";

export default function SettingsPage() {
  return (
    <main className="settings-page space-shell" aria-labelledby="app-page-title">
      <div className={styles.container}>
        <section className={styles.section} aria-labelledby="preferences-heading">
          <h2 id="preferences-heading" className={styles.sectionTitle}>
            Preferences
          </h2>
          <p className={styles.sectionHint}>
            No configurable preferences are available yet.
          </p>
        </section>
      </div>
    </main>
  );
}
