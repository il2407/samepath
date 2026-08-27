import { Header } from "@/app/_marketing/Header";
import { Hero } from "@/app/_marketing/Hero";
import { Problem } from "@/app/_marketing/Problem";
import { HowItWorks } from "@/app/_marketing/HowItWorks";
import { Privacy } from "@/app/_marketing/Privacy";
import { FormatsAndGuides } from "@/app/_marketing/FormatsAndGuides";
import { Access } from "@/app/_marketing/Access";
import { Faq } from "@/app/_marketing/Faq";
import { FinalCta } from "@/app/_marketing/FinalCta";
import { Footer } from "@/app/_marketing/Footer";

export default function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Privacy />
        <FormatsAndGuides />
        <Access />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
