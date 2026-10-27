/** Only explicitly enabled builds replace the full-stack services. */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const assetPath = (path: string) => `${BASE_PATH}${path}`;
export const postHref = (id: number, edit = false) =>
  DEMO_MODE && id >= 1000
    ? `/posts/demo/${edit ? "edit/" : ""}?id=${id}`
    : `/posts/${id}${edit ? "/edit" : ""}`;
export const groupHref = (id: number, settings = false) =>
  DEMO_MODE && id >= 1000
    ? `/groups/demo/${settings ? "settings/" : ""}?groupId=${id}`
    : `/groups/${id}${settings ? "/settings" : ""}`;
