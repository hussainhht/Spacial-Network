import Link from "next/link";
import AppIcon from "../AppIcon";
import type { NavigationItem as NavigationItemConfig } from "./navigation.config";
import styles from "./NavigationItem.module.css";

interface NavigationItemProps {
  item: NavigationItemConfig;
  active: boolean;
  className?: string;
  labelClassName?: string;
}

export default function NavigationItem({
  item,
  active,
  className,
  labelClassName,
}: NavigationItemProps) {
  return (
    <Link
      href={item.href}
      className={`${styles.link} ${item.emphasis ? styles.emphasis : ""} ${className ?? ""}`}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      title={item.label}
    >
      <span className={styles.node} aria-hidden="true">
        <AppIcon name={item.icon} />
      </span>
      <span className={`${styles.label} ${labelClassName ?? ""}`}>{item.label}</span>
    </Link>
  );
}
