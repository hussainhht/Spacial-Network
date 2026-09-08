import UniverseTransitionProvider from "@/features/universe-transition/UniverseTransitionProvider";
import SpaceBackground from "@/components/space/SpaceBackground";
import { GroupsSearchProvider } from "@/features/groups/context/GroupsSearchProvider";
import TopNavbar from "./TopNavbar";
import AppSidebar from "./AppSidebar";
import styles from "./AppShell.module.css";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <GroupsSearchProvider>
      <UniverseTransitionProvider>
        <div className={styles.shell}>
          <SpaceBackground />
          <a href="#page-content" className={styles.skipLink}>
            Skip to content
          </a>
          <AppSidebar />
          <div className={styles.mainArea}>
            <TopNavbar />
            <div
              id="page-content"
              tabIndex={-1}
              className={styles.routeContent}
            >
              {children}
            </div>
          </div>
        </div>
      </UniverseTransitionProvider>
    </GroupsSearchProvider>
  );
}
