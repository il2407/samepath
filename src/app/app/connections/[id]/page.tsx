import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getConnectionDetail, getMeetingProposals, hasGoogleMeetGrant } from "@/modules/connections/service";
import { ConnectionRoom } from "@/modules/connections/ConnectionRoom";
import { PRACTICE_SESSION_CATEGORIES } from "@/modules/guides/service";
import { Container } from "@/shared/ui/Container";

export default async function ConnectionDetailPage({ params }: PageProps<"/app/connections/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const connection = await getConnectionDetail(user.id, id);
  if (!connection) notFound();

  const meetingProposals = await getMeetingProposals(user.id, id);
  const hasGoogleMeetConnected = await hasGoogleMeetGrant(user.id);

  return (
    <Container className="max-w-2xl py-10">
      <ConnectionRoom
        connection={connection}
        meetingProposals={meetingProposals}
        currentUserId={user.id}
        categories={PRACTICE_SESSION_CATEGORIES}
        hasGoogleMeetConnected={hasGoogleMeetConnected}
      />
    </Container>
  );
}
