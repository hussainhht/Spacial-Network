type NavbarContext = {
  title: string;
  eyebrow: string;
  searchMode: "global" | "groups";
  action?: { href: string; label: string; ariaLabel: string };
};
const newPost = {
  href: "/posts/new",
  label: "New Post",
  ariaLabel: "Create new post",
};
const createGroup = {
  href: "/groups/create",
  label: "Create Group",
  ariaLabel: "Create Group",
};

const sections: Record<string, string> = {
  posts: "Posts",
  groups: "Groups",
  chat: "Messages",
  profile: "Profile",
  notifications: "Notifications",
  dev: "3D Models",
};

export function getNavbarContext(pathname: string): NavbarContext {
  if (pathname === "/")
    return {
      title: "Home",
      eyebrow: "Your orbit",
      searchMode: "global",
      action: newPost,
    };
  if (pathname === "/groups")
    return {
      title: "Groups",
      eyebrow: "Your communities",
      searchMode: "groups",
      action: createGroup,
    };
  const [, section, detail] = pathname.split("/");
  const title =
    pathname === "/groups/create"
      ? "Create Group"
      : pathname === "/posts/new"
        ? "New Post"
        : (sections[section] ?? "Social Network");
  return {
    title,
    eyebrow: section === "dev" ? "Development" : "Your universe",
    searchMode: "global",
    action: section === "posts" && !detail ? newPost : undefined,
  };
}
