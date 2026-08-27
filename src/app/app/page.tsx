import { requireUser } from "@/modules/auth/session";
import { Container } from "@/shared/ui/Container";

export default async function AppHomePage() {
  const user = await requireUser();

  return (
    <Container className="py-12">
      <h1 className="text-2xl font-bold text-ink">ברוכים הבאים ל-SamePath</h1>
      <p className="mt-2 text-muted">
        החשבון שלכם ({user.email}) מאומת ופעיל. השלב הבא — בניית הפרופיל המקצועי — יופיע כאן בקרוב.
      </p>
    </Container>
  );
}
