/** Inserts text at the textarea's selection. Returns null if the result would exceed maxLength. */
export function insertAtCursor(
  textarea: HTMLTextAreaElement | null,
  current: string,
  insert: string,
  maxLength: number,
): { value: string; caret: number } | null {
  const start = Math.min(textarea?.selectionStart ?? current.length, current.length);
  const end = Math.min(textarea?.selectionEnd ?? start, current.length);
  const value = current.slice(0, start) + insert + current.slice(end);
  if (value.length > maxLength) return null;
  return { value, caret: start + insert.length };
}
