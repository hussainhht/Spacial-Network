import styles from "./RegisterForm.module.css";

export type RegisterStep = "account" | "personal" | "profile";

const STEPS: { id: RegisterStep; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "personal", label: "Personal" },
  { id: "profile", label: "Profile" },
];

export default function RegisterProgress({
  currentStep,
}: {
  currentStep: RegisterStep;
}) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep);

  return (
    <div className={styles.progressWrap}>
      <div className={styles.steps} aria-label="Registration progress">
        {STEPS.map((step, index) => {
          const isDone = index < currentIndex;
          const isActive = index === currentIndex;
          return (
            <div key={step.id} className={styles.stepFragment}>
              <span
                className={`${styles.step} ${
                  isDone ? styles.stepDone : isActive ? styles.stepActive : ""
                }`}
                aria-current={isActive ? "step" : undefined}
              >
                <span className={styles.stepMarker} aria-hidden="true">
                  {isDone ? "✓" : index + 1}
                </span>
                <span className={styles.stepLabel}>{step.label}</span>
              </span>
              {index < STEPS.length - 1 && (
                <span
                  className={`${styles.stepRail} ${
                    isDone ? styles.stepRailDone : ""
                  }`}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>
      <p className={styles.stepCompact}>
        Step {currentIndex + 1} of {STEPS.length}
      </p>
    </div>
  );
}
