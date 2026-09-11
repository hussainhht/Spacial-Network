/** Which chrome a route gets.
 *
 * `universe` is navbar-only: one locked pane that owns the whole viewport, with
 * the top navbar as the single navigation surface. The persistent 3D scene docks
 * into these routes, so a reserved sidebar column would change the pane the
 * scene measures itself against — and the planet anchors are expressed as
 * fractions of that pane.
 *
 * `sidebar` is the original shell, kept for the routes that still navigate
 * through it. The project direction is to remove the sidebar entirely, so
 * nothing here is a redesign of it: routes move from one list to the other as
 * their navbar-only replacement lands, and the last move deletes the branch.
 */
export type ShellLayout = "universe" | "sidebar";

/** Exact routes that own their pane. */
const UNIVERSE_ROUTES = new Set(["/", "/posts"]);

/** Sections that own their pane, including their sub-routes. Groups is one
 * world: opening a group, or creating one, must not make a sidebar reappear. */
const UNIVERSE_SECTIONS = ["/groups"];

export function shellLayoutFor(pathname: string): ShellLayout {
  if (UNIVERSE_ROUTES.has(pathname)) return "universe";
  const section = UNIVERSE_SECTIONS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return section ? "universe" : "sidebar";
}
