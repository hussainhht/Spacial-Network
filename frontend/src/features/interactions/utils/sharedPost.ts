// A shared post arrives as a chat message whose content is either just the
// post's in-site link, or an optional note followed by the link on its own
// line - see the backend's share.composeMessage (internal/share/service.go).
// Parsing it back out lets chat render a preview card instead of raw text.

const POST_LINK_PATTERN = /^\/posts\/(\d+)$/;

export interface SharedPost {
  postId: number;
  note?: string;
}

export function parseSharedPost(content: string): SharedPost | null {
  const lines = content.split("\n");
  const lastLine = lines[lines.length - 1];
  const match = lastLine.match(POST_LINK_PATTERN);
  if (!match) return null;

  const note = lines.slice(0, -1).join("\n").trim();
  return { postId: Number(match[1]), note: note || undefined };
}
