import PageTransition from "@/components/transitions/PageTransition";
import SettingsPage from "@/features/settings/components/SettingsPage";

export default function Page() {
  return (
    <PageTransition>
      <SettingsPage />
    </PageTransition>
  );
}
