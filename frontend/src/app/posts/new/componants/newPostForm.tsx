"use client";

import { useRouter } from "next/navigation";
import { createPost, type PostInput } from "@/lib/posts-api";
import PostForm from "../../components/PostForm";

export default function NewPostForm() {
  const router = useRouter();

  async function handleSubmit(input: PostInput) {
    await createPost(input);
    router.push("/posts");
  }

  return (
    <PostForm
      submitLabel="Create post"
      pendingLabel="Creating..."
      onSubmit={handleSubmit}
    />
  );
}
