import type { AppIconName } from "../AppIcon";

export interface NavigationItem {
  href: string;
  label: string;
  icon: AppIconName;
  /** Stronger visual treatment. Only the Create destination sets this today. */
  emphasis?: boolean;
}

export const PRIMARY_NAVIGATION: NavigationItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/posts", label: "Posts", icon: "posts" },
  { href: "/groups", label: "Groups", icon: "groups" },
  { href: "/posts/new", label: "Create", icon: "plus", emphasis: true },
  { href: "/chat", label: "Messages", icon: "chat" },
  { href: "/profile", label: "Profile", icon: "user" },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}
