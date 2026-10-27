import { Suspense } from "react";
import { DEMO_MODE } from "@/demo/config";
import { createSeed } from "@/demo/seed";
import PostDetailClient from "./PostDetailClient";
export function generateStaticParams() {
  return DEMO_MODE ? [...createSeed().posts.map(p=>({id:String(p.id)})),{id:"demo"}] : [];
}
export default function Page() { return <Suspense><PostDetailClient /></Suspense>; }
