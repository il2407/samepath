import { listConnectionsForUser } from "./service";
import { ProposeContent } from "./ProposeContent";

export async function ContentProposal({
  userId,
  contentKey,
  connectionId,
}: {
  userId: string;
  contentKey: string;
  connectionId?: string;
}) {
  const connections = await listConnectionsForUser(userId);
  return (
    <ProposeContent
      contentKey={contentKey}
      connectionId={connectionId}
      connections={connections
        .filter((c) => c.status === "ACTIVE")
        .map((c) => ({
          id: c.id,
          name: c.otherPartyFullName ?? c.otherPartyDisplayName,
          revision: c.practice?.revision ?? 0,
        }))}
    />
  );
}
