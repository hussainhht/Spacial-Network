import AppSidebar from "./AppSidebar";
import styles from "./AppShell.module.css";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <a href="#page-content" className={styles.skipLink}>Skip to content</a>
      <AppSidebar />
      <div id="page-content" tabIndex={-1} className={styles.routeContent}>{children}</div>
    </div>
  );
}
