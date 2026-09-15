"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Main route error:", error);
  }, [error]);

  return (
    <main>
      <h1>Something went wrong</h1>
      <p>We could not load this page. Please try again.</p>

      <button type="button" onClick={reset}>
        Try again
      </button>

      <Link href="/">Go home</Link>
    </main>
  );
}