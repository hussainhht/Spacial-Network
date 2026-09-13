import Link from "next/link";
import AppIcon from "../AppIcon";
import type { NavigationItem as NavigationItemConfig } from "./navigation.config";

interface NavigationItemProps {
  item: NavigationItemConfig;
  active: boolean;
  className?: string;
  iconWrapClassName?: string;
  labelClassName?: string;
}

export default function NavigationItem({
  item,
  active,
  className,
  iconWrapClassName,
  labelClassName,
}: NavigationItemProps) {
  return (
    <Link
      href={item.href}
      className={className}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      title={item.label}
    >
      <span className={iconWrapClassName}>
        <AppIcon name={item.icon} />
      </span>
      <span className={labelClassName}>{item.label}</span>
    </Link>
  );
}
