import { GIF_CATALOG, type CatalogGif } from "./gifCatalog";

// Only GIFs served from this origin are ever rendered as images or sent from the picker.
const TRUSTED_GIF_HOST = "media.giphy.com";
const GIF_PATH = /^\/media\/[A-Za-z0-9]{6,40}\/(giphy|200w)\.gif$/;

export function gifUrlFromId(id: string) {
  return `https://${TRUSTED_GIF_HOST}/media/${id}/giphy.gif`;
}

export function isTrustedGifUrl(value: string): boolean {
  if (value.length > 200) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === TRUSTED_GIF_HOST &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      GIF_PATH.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/** Returns the GIF URL when the whole message is exactly one trusted GIF URL. */
export function parseGifMessage(content: string | null | undefined): string | null {
  const trimmed = content?.trim();
  return trimmed && isTrustedGifUrl(trimmed) ? trimmed : null;
}

/** Smaller rendition used for picker thumbnails. */
export function gifThumbUrl(fullUrl: string) {
  return fullUrl.replace(/\/giphy\.gif$/, "/200w.gif");
}

function interleaved(): CatalogGif[] {
  // Catalog entries are grouped by topic; interleave them for a varied "trending" view.
  const byTag = new Map<string, CatalogGif[]>();
  for (const gif of GIF_CATALOG) byTag.set(gif.tags, [...(byTag.get(gif.tags) ?? []), gif]);
  const groups = [...byTag.values()];
  const result: CatalogGif[] = [];
  for (let i = 0; result.length < GIF_CATALOG.length; i++) {
    for (const group of groups) if (group[i]) result.push(group[i]);
  }
  return result;
}

const TRENDING = interleaved();

export function searchGifs(query: string, limit = 30): CatalogGif[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return TRENDING.slice(0, limit);
  return GIF_CATALOG.filter((gif) => terms.every((t) => gif.tags.includes(t))).slice(0, limit);
}
