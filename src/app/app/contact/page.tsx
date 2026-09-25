import { EditorialPhoto } from "@/shared/ui/EditorialPhoto";
import type { Metadata } from "next";
import { Container } from "@/shared/ui/Container";

export const metadata: Metadata = { title: "צור קשר — SamePath" };

export default function ContactPage() {
  return (
    <Container className="max-w-2xl py-10">
      <EditorialPhoto scene="conversation" label="צור קשר" caption="בואו נדבר." />
      <h1 className="text-2xl font-bold text-ink">צור קשר</h1>
      <p className="mt-3 text-muted leading-relaxed">
        יש לכם שאלה, בעיה טכנית או הצעה לשיפור? אשמח מאוד לשמוע.
      </p>

      <a
        href="mailto:idolev53@gmail.com"
        className="mt-6 inline-flex items-center rounded-2xl border border-border bg-white px-5 py-4 font-medium text-ink hover:border-primary"
      >
        idolev53@gmail.com
      </a>
    </Container>
  );
}
