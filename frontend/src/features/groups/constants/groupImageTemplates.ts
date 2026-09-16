export const GROUP_IMAGE_TEMPLATES = [
  {
    id: "earth",
    src: "/image/templets/earth.png",
    label: "Earth",
  },
  {
    id: "mars",
    src: "/image/templets/mars.png",
    label: "Mars",
  },
  {
    id: "moon",
    src: "/image/templets/moon.png",
    label: "Moon",
  },
  {
    id: "saturn",
    src: "/image/templets/saturn.png",
    label: "Saturn",
  },
] as const;

export type GroupImageTemplate = (typeof GROUP_IMAGE_TEMPLATES)[number];
export type GroupImageTemplateId = GroupImageTemplate["id"];
