"use client";

import { PlanetPreferenceProvider, usePlanetPreference } from "@/components/space/PlanetPreferenceProvider";
import LoginPlanetStage from "@/features/auth/components/LoginPlanetStage";
import LoginForm from "@/features/auth/components/LoginForm";
import styles from "./page.module.css";

function LoginPageShell() {
  const { selectedPlanetId, themeStyle } = usePlanetPreference();

  return (
    <main
      className={styles.page}
      data-planet={selectedPlanetId}
      style={themeStyle}
    >
      <div className={styles.grid}>
        <LoginPlanetStage />
        <div className={styles.formColumn}>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <PlanetPreferenceProvider>
      <LoginPageShell />
    </PlanetPreferenceProvider>
  );
}
