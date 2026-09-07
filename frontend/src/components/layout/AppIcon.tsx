import type { SVGProps } from "react";

const paths = {
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  posts: "M7 3h13v14H7z M4 7H3v14h13v-1 M10 7h7 M10 11h7",
  groups: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-3.87 M16 3a4 4 0 0 1 0 8 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  chat: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 3V11.5A8.5 8.5 0 0 1 9.5 3h3a8.5 8.5 0 0 1 8.5 8.5Z M7 10h8 M7 14h5",
  user: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2 M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  logout: "M9 3H4v18h5 M9 12h12 m-4-4 4 4-4 4",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  plus: "M12 5v14 M5 12h14",
  arrow: "M4 12h16 m-6-6 6 6-6 6",
  orbit: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M21 3C16-2-2 16 3 21S26 8 21 3Z",
  planet:
    "M8 12A4 4 0 1 0 16 12A4 4 0 1 0 8 12 M3 12A9 2.6 0 1 0 21 12A9 2.6 0 1 0 3 12",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  "eye-off":
    "M3 3l18 18 M10.6 10.6a3 3 0 0 0 4.24 4.24 M9.9 4.24A11 11 0 0 1 12 4c7 0 11 8 11 8a18.7 18.7 0 0 1-3.22 4.44 M6.1 6.1A18.7 18.7 0 0 0 1 12s4 8 11 8a10.9 10.9 0 0 0 5.1-1.24",
  upload: "M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 21h14",
} satisfies Record<string, string>;

export type AppIconName = keyof typeof paths;

export default function AppIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: AppIconName }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={paths[name]} />
    </svg>
  );
}
