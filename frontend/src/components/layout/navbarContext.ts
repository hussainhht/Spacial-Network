type NavbarContext = {
  title: string;
  eyebrow: string;
};

const sections: Record<string, string> = {
  posts: "Posts",
  groups: "Groups",
  chat: "Messages",
  profile: "Profile",
  notifications: "Notifications",
  settings: "Settings",
};

export function getNavbarContext(pathname: string): NavbarContext {
  if (pathname === "/")
    return {
      title: "Home",
      eyebrow: "Your community",
    };
  if (pathname === "/groups")
    return {
      title: "Groups",
      eyebrow: "Your communities",
    };
  const [, section] = pathname.split("/");
  const title =
    pathname === "/groups/create"
      ? "Create Group"
      : pathname === "/posts/new"
        ? "New Post"
        : (sections[section] ?? "Social Network");
  return {
    title,
    eyebrow: "Your community",
  };
}
