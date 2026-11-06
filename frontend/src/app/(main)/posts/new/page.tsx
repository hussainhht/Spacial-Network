import type { Metadata } from "next";
import PageTransition from "@/components/transitions/PageTransition";
import NewPostForm from "@/features/posts/components/NewPostForm";

export const metadata: Metadata = { title: "New Post" };

export default function NewPostPage() {
  return (
    <PageTransition>
      <main className="new-post-page" data-motion-section>
        <NewPostForm />
      </main>
    </PageTransition>
  );
}
