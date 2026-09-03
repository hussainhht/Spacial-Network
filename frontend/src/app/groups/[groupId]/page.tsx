// import GroupDetailsContent from "@/features/groups/components/GroupDetailsContent";
// import StateMessage from "@/features/groups/components/StateMessage";

interface GroupDetailsPageProps {
  params: Promise<{ groupId: string }>;
}

export default async function GroupDetailsPage({ params }: GroupDetailsPageProps) {
  const { groupId } = await params;
  const parsedId = Number(groupId);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    // return <StateMessage title="Unable to load this group." />;
  }

  // return <GroupDetailsContent key={parsedId} groupId={parsedId} />;
}
