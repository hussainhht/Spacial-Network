import type { Metadata } from "next";
import GroupsPageContent from "@/features/groups/components/GroupsPageContent";

export const metadata: Metadata = {
  title: "Groups | Social Network",
};

export default function GroupsPage() {
  return <GroupsPageContent />;
}
