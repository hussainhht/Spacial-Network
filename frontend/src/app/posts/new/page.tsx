import Link from "next/link";
import NewPostForm from "./componants/newPostForm";

export default function NewPostPage() {
  return (
    <main className="new-post-page">
      <div className="new-post-container">
        <Link href="/posts" className="back-link">
          &larr; Back to posts
        </Link>

        <h1>Create a new post</h1>
        <p>Share something with the community.</p>

        <NewPostForm />
      </div>
    </main>
  );
}
