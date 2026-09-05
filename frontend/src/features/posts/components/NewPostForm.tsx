"use client";

import { useRouter } from "next/navigation";
import { createPost } from "@/features/posts/api/posts";
import type { PostInput } from "@/features/posts/types/post";
import PostForm from "./PostForm";

export default function NewPostForm() {
  const router = useRouter();

  async function handleSubmit(input: PostInput & { image?: File | null }) {
    await createPost(input);
    router.push("/posts");
  }

  return (
    <PostForm
      submitLabel="Create post"
      pendingLabel="Creating..."
      showImage
      onSubmit={handleSubmit}
    />
  );
}
