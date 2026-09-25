import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getOnboardingStep } from "@/modules/profiles/service";
import { getActiveSuggestionsForUser } from "@/modules/matching/service";
import { listConnectionsForUser } from "@/modules/connections/service";
import { sendExpiryRemindersDue } from "@/modules/access-passes/service";
import { Container } from "@/shared/ui/Container";
import { FirstLoginWelcome } from "@/app/app/FirstLoginWelcome";
import styles from "./platform.module.css";

const stepPaths = {
  profile: "/app/onboarding/profile",
  privacy: "/app/onboarding/privacy",
  preferences: "/app/onboarding/preferences",
  overview: "/app/onboarding/overview",
} as const;

function MatchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="15" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10.5 10.8 13.5 13.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ConnectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <path
        d="M9 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM15 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="m11.2 10.4 1.6 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function GuideIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <path
        d="M5 5.5A1.5 1.5 0 0 1 6.5 4H12v16H6.5A1.5 1.5 0 0 1 5 18.5v-13ZM19 5.5A1.5 1.5 0 0 0 17.5 4H12v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function AppHomePage({ searchParams }: PageProps<"/app">) {
  const user = await requireUser();
  const step = await getOnboardingStep(user.id);
  if (step !== "done") redirect(stepPaths[step]);

  const params = await searchParams;
  const isFirstLogin = params?.welcome === "1";
  const firstMatchCount = typeof params?.matches === "string" ? Number(params.matches) || 0 : 0;

  // Lazy, idempotent (no cron in the MVP) — cheap enough at this user scale;
  // a real deployment should move this to a scheduled job instead.
  await sendExpiryRemindersDue();

  const [suggestions, connections] = await Promise.all([
    getActiveSuggestionsForUser(user.id),
    listConnectionsForUser(user.id),
  ]);
  const activeConnections = connections.filter((c) => c.status === "ACTIVE");

  const awaitingResponse = activeConnections.filter(c => c.practice?.pending && c.practice.proposedBy !== user.id).length;

  const primaryCard = {
    href: "/app/matches",
    icon: <MatchIcon />,
    title: "הצעות התאמה",
    description:
      suggestions.length > 0
        ? "מצאנו אנשים שיכולים להתאים לכם. ההצעות מחכות לכם כאן."
        : "מחפשים עבורכם ברקע. כשתהיה התאמה טובה, היא תופיע כאן.",
    stat: suggestions.length,
    statLabel: "הצעות ממתינות",
    cta: suggestions.length > 0 ? "לצפייה בהצעות" : "לאזור הצעות ההתאמה",
  };

  const secondaryCards = [
    {
      href: "/app/connections",
      icon: <ConnectionIcon />,
      title: "החיבורים שלי",
      description:
        awaitingResponse > 0
          ? `${awaitingResponse} הצעות תוכן מחכות לתגובה שלך.`
          : activeConnections.length > 0
          ? "אישרתם הדדית. מתחילים בשיחה קצרה ובוחרים יחד תוכן למפגש."
          : "כשתאשרו הצעת התאמה הדדית, החיבור יופיע כאן.",
      stat: activeConnections.length,
      statLabel: "חיבורים פעילים",
      cta: awaitingResponse > 0 ? "לבחינת ההצעות בחיבורים" : "לצפייה בחיבורים",
      group: "match" as const,
    },
    {
      href: "/app/guides",
      icon: <GuideIcon />,
      title: "מערכי מפגש ושאלות מראיונות",
      description: "בוחרים יחד מה לתרגל. אפשר לעיין בתוכן בכל עת ולהציע אותו לחיבור.",
      stat: null,
      statLabel: null,
      cta: "לעיון בתוכן",
      group: "session" as const,
    },

  ];

  return (
    <Container className={styles.dashboard}>
      {isFirstLogin && <FirstLoginWelcome matchCount={firstMatchCount} pendingApproval={user.status === "PENDING_APPROVAL"} />}

      <section className={styles.dashboardHero}>
        <div>
          <span className={styles.dashboardEyebrow}>הדרך שלכם מתחילה באנשים</span>
          <h1>עוד שיחה. עוד תרגול.<br />צעד קרוב יותר.</h1>
        </div>
        <Image src="/images/community-abstract.webp" alt="" width={1536} height={1024} sizes="(max-width: 640px) 40vw, 300px" />
      </section>

      <p className="mb-5 text-sm text-muted">בוחנים התאמות, מתחברים ומכירים, ובוחרים יחד מה לתרגל. אפשר לעבור בין האזורים בכל עת.</p>
      <div className={styles.dashboardCards}>
        <Link
          href={primaryCard.href}
          className={`group ${styles.featureCard}`}
        >
          <div>
            <div className="flex items-center gap-3">
              <span className={styles.cardIcon}>
                {primaryCard.icon}
              </span>
              <div>
                <p className="font-semibold text-ink">{primaryCard.title}</p>
                {primaryCard.stat > 0 && (
                  <p className="text-sm text-muted">
                    {primaryCard.stat} {primaryCard.statLabel}
                  </p>
                )}
              </div>
            </div>
            <p className={styles.dashboardDescription}>{primaryCard.description}</p>
          </div>
          <span className={styles.primaryCta}>
            {primaryCard.cta}
            <span aria-hidden className="transition-transform group-hover:-translate-x-0.5">
              ←
            </span>
          </span>
        </Link>

        <div className={styles.dashboardSecondary}>
          {secondaryCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className={`${styles.secondaryCard} ${
                card.group === "match" ? styles.cardGroupMatch : styles.cardGroupSession
              }`}
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className={styles.cardIcon}>
                    {card.icon}
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{card.title}</p>
                    {card.stat !== null && card.stat > 0 && (
                      <p className="text-sm text-muted">
                        {card.stat} {card.statLabel}
                      </p>
                    )}
                  </div>
                </div>
                <p className={styles.dashboardDescription}>{card.description}</p>
              </div>
              <span className={styles.secondaryCta}>{card.cta} ←</span>
            </Link>
          ))}
        </div>
      </div>
    </Container>
  );
}
