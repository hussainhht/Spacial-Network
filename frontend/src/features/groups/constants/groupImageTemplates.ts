import { assetPath } from "@/demo/config";
export const GROUP_IMAGE_TEMPLATES = [
  {
    id: "earth",
    src: assetPath("/image/templets/earth.png"),
    label: "Earth",
  },
  {
    id: "mars",
    src: assetPath("/image/templets/mars.png"),
    label: "Mars",
  },
  {
    id: "moon",
    src: assetPath("/image/templets/moon.png"),
    label: "Moon",
  },
  {
    id: "saturn",
    src: assetPath("/image/templets/saturn.png"),
    label: "Saturn",
  },
] as const;

export type GroupImageTemplate = (typeof GROUP_IMAGE_TEMPLATES)[number];
export type GroupImageTemplateId = GroupImageTemplate["id"];
