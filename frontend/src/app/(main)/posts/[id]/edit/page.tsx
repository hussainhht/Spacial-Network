import type { Metadata } from "next";
import { Suspense } from "react";
import { DEMO_MODE } from "@/demo/config";
import { createSeed } from "@/demo/seed";
import PostEditClient from "./PostEditClient";
export const metadata: Metadata = { title: "Edit Post" };

export function generateStaticParams() {
  return DEMO_MODE ? [...createSeed().posts.map(p=>({id:String(p.id)})),{id:"demo"}] : [];
}
export default function Page() { return <Suspense><PostEditClient /></Suspense>; }
