/**
 * General text and string formatting utilities.
 */

/**
 * Generates 1 or 2 uppercase initials from a name or username.
 * Example:
 *   getInitials("John", "Doe", "johndoe") => "JD"
 *   getInitials("", "", "alice") => "AL"
 *   getInitials() => "?"
 */
export function getInitials(
  firstName?: string,
  lastName?: string,
  username?: string
): string {
  const first = firstName?.trim();
  const last = lastName?.trim();
  const user = username?.trim();

  if (first && last) {
    return (first[0] + last[0]).toUpperCase();
  }

  if (first) {
    return first.slice(0, 2).toUpperCase();
  }

  if (user) {
    return user.slice(0, 2).toUpperCase();
  }

  return "?";
}

/**
 * Returns formatted full name if available, otherwise falls back to username.
 */
export function getDisplayName(
  firstName?: string,
  lastName?: string,
  username?: string
): string {
  const first = firstName?.trim();
  const last = lastName?.trim();

  if (first && last) {
    return `${first} ${last}`;
  }

  if (first) {
    return first;
  }

  return username?.trim() || "Anonymous";
}

/**
 * Truncates text to a maximum length with an ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}
