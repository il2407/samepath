import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getConnectionDetail, getMeetingProposals, type MeetingProposalDetail } from "@/modules/connections/service";
import { ConnectionRoom } from "@/modules/connections/ConnectionRoom";
import { PRACTICE_SESSION_CATEGORIES } from "@/modules/guides/service";
import { Container } from "@/shared/ui/Container";

export default async function ConnectionDetailPage({ params }: PageProps<"/app/connections/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const connection = await getConnectionDetail(user.id, id);
  if (!connection) notFound();

  // getMeetingProposals reads the new, additive MeetingProposal table (WS7,
  // backlog item 14) — until the coordinator applies its migration (this
  // wave's protocol deliberately defers `prisma migrate` to them), the query
  // throws "relation does not exist". Caught here, not left to crash the
  // whole room: every other part of the connection (chat, session picker,
  // suggested-session guide) has nothing to do with this table and should
  // keep working today. Remove this try/catch once the migration lands.
  let meetingProposals: MeetingProposalDetail[] = [];
  try {
    meetingProposals = await getMeetingProposals(user.id, id);
  } catch (error) {
    console.error("meeting proposals unavailable — MeetingProposal migration pending (WS7)", error);
  }

  return (
    <Container className="max-w-2xl py-10">
      <ConnectionRoom
        connection={connection}
        meetingProposals={meetingProposals}
        currentUserId={user.id}
        categories={PRACTICE_SESSION_CATEGORIES}
      />
    </Container>
  );
}
