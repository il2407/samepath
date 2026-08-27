import { notFound } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getConnectionDetail } from "@/modules/connections/service";
import { ConnectionRoom } from "@/modules/connections/ConnectionRoom";
import { Container } from "@/shared/ui/Container";

export default async function ConnectionDetailPage({ params }: PageProps<"/app/connections/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const connection = await getConnectionDetail(user.id, id);
  if (!connection) notFound();

  return (
    <Container className="max-w-2xl py-10">
      <ConnectionRoom connection={connection} currentUserId={user.id} />
    </Container>
  );
}
