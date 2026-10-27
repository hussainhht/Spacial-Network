"use client";

import { PlanetPreferenceProvider, usePlanetPreference } from "@/components/space/PlanetPreferenceProvider";
import RegisterPlanetStage from "@/features/auth/components/RegisterPlanetStage";
import RegisterForm from "@/features/auth/components/RegisterForm";
import { DEMO_MODE } from "@/demo/config";
import DemoEntry from "@/demo/DemoEntry";
import styles from "./page.module.css";

function RegisterPageShell() {
  const { selectedPlanetId, themeStyle } = usePlanetPreference();

  return (
    <main
      className={styles.page}
      data-planet={selectedPlanetId}
      style={themeStyle}
    >
      <div className={styles.grid}>
        <RegisterPlanetStage />
        <div className={styles.formColumn}>
          {DEMO_MODE ? <DemoEntry /> : <RegisterForm />}
        </div>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <PlanetPreferenceProvider>
      <RegisterPageShell />
    </PlanetPreferenceProvider>
  );
}
