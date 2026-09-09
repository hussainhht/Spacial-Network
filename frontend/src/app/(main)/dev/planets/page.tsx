import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PlanetDevPage from "@/features/planets-dev/PlanetDevPage";

export const metadata: Metadata = {
  title: "Planet Lab",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PlanetDevPage />;
}
