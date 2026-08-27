import { LinkButton } from "@/shared/ui/Button";
import { Container } from "@/shared/ui/Container";

export function FinalCta() {
  return (
    <section className="py-16 sm:py-24">
      <Container className="flex flex-col items-center gap-6 text-center">
        <h2 className="max-w-xl text-3xl font-bold text-ink sm:text-4xl">
          יש מי שנמצא בדיוק באותה נקודה. בלי לחפש לבד.
        </h2>
        <LinkButton href="/register">להצטרפות לקהילה</LinkButton>
      </Container>
    </section>
  );
}
