export type TextSegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

const URL_PATTERN = /https?:\/\/[^\s<>]+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:'"’”…]$/;
const CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

function count(text: string, char: string) {
  return text.split(char).length - 1;
}

// Removes sentence punctuation and unbalanced closing brackets that follow a URL.
function trimUrl(candidate: string) {
  let url = candidate;
  for (;;) {
    const last = url.at(-1);
    if (!last) return url;
    if (TRAILING_PUNCTUATION.test(last)) {
      url = url.slice(0, -1);
    } else if (last in CLOSERS && count(url, last) > count(url, CLOSERS[last])) {
      url = url.slice(0, -1);
    } else {
      return url;
    }
  }
}

function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/** Splits text into plain and http(s) link segments. Never produces HTML. */
export function splitLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;
  const push = (value: string) => {
    if (!value) return;
    const last = segments.at(-1);
    if (last?.type === "text") last.value += value;
    else segments.push({ type: "text", value });
  };

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    const url = trimUrl(match[0]);
    const href = safeHref(url);
    if (!href) continue;
    push(text.slice(cursor, start));
    segments.push({ type: "link", value: url, href });
    cursor = start + url.length;
  }
  push(text.slice(cursor));
  return segments;
}
