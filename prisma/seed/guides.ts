import { PrismaClient } from "@/generated/prisma/client";

/** Optional session guides (spec §9) — never required, never tracked for completion. */
export async function seedGuides(prisma: PrismaClient) {
  await upsertGuide(prisma, {
    id: "seed-guide-first-meeting",
    title: "היכרות ראשונה",
    purpose: "מסגרת קלה לפתיחת השיחה הראשונה, בלי מבוכה של \"אז... מאיפה מתחילים?\"",
    suggestedDurationMinutes: 30,
    format: "ONE_ON_ONE",
    category: "היכרות",
    order: 0,
    steps: [
      { title: "פתיחה", prompt: "שתפו קצר מי אתם מקצועית ומה מביא אתכם ל-SamePath, בלי לחשוף פרטים מזהים.", kind: "AGENDA" },
      { title: "המצב הנוכחי", prompt: "מה שלב תהליך החיפוש שלכם היום? מה הכי מאתגר בו כרגע?", kind: "PROMPT" },
      { title: "מה תרצו מהחיבור הזה", prompt: "ליווי קבוע? שיחה חד-פעמית? תרגול משותף?", kind: "PROMPT" },
      { title: "המשך אפשרי", prompt: "אם היה נעים — האם יש טעם לקבוע עוד שיחה?", kind: "FOLLOWUP" },
    ],
  });

  await upsertGuide(prisma, {
    id: "seed-guide-accountability",
    title: "צ׳ק-אין שבועי",
    purpose: "מפגש קצר לשמירה על מומנטום בתהליך החיפוש, בסגנון ליווי הדדי.",
    suggestedDurationMinutes: 20,
    format: "BOTH",
    category: "ליווי הדדי",
    order: 1,
    steps: [
      { title: "מה קרה השבוע", prompt: "מה עשיתם השבוע בתהליך החיפוש? מה הלך טוב, מה פחות?", kind: "AGENDA" },
      { title: "התחייבות לשבוע הבא", prompt: "מה תרצו להספיק עד הפעם הבאה?", kind: "PROMPT" },
      { title: "תמיכה", prompt: "יש משהו ספציפי שהייתם רוצים עזרה או נקודת מבט עליו?", kind: "PROMPT" },
    ],
  });

  await upsertGuide(prisma, {
    id: "seed-guide-system-design",
    title: "דיון בעיצוב מערכות",
    purpose: "תרגול משותף אופציונלי — לחשוב יחד על בעיית עיצוב מערכת, לא ראיון.",
    suggestedDurationMinutes: 45,
    format: "BOTH",
    category: "תרגול ממוקד",
    order: 2,
    steps: [
      { title: "בחירת נושא", prompt: "בחרו יחד בעיה להתמקד בה (למשל: עיצוב מערכת קיצור קישורים).", kind: "AGENDA" },
      { title: "דרישות", prompt: "מהן הדרישות הפונקציונליות והלא-פונקציונליות המרכזיות?", kind: "PROMPT" },
      { title: "עיצוב ראשוני", prompt: "שרטטו יחד ארכיטקטורה כללית — בלי לחפש \"תשובה נכונה\".", kind: "PROMPT" },
      { title: "נקודות להעמקה", prompt: "אילו חלקים הייתם רוצים להעמיק בהם בפעם הבאה?", kind: "FOLLOWUP" },
    ],
  });

  // Attach the accountability guide to the eligible demo group, if it exists.
  await prisma.group.updateMany({
    where: { id: "seed-group-eligible" },
    data: { guideId: "seed-guide-accountability" },
  });

  await upsertGuide(prisma, {
    id: "seed-guide-interview-sim",
    title: "סימולציית ראיון",
    purpose: "תרגול הדדי ומוסכם מראש — לא הליבה של SamePath, אבל אופציה נחמדה כשמתאים לשניכם.",
    suggestedDurationMinutes: 40,
    format: "ONE_ON_ONE",
    category: "תרגול ממוקד",
    order: 3,
    steps: [
      { title: "הסכמה על הפורמט", prompt: "מי מראיין ראשון? כמה זמן לכל תפקיד?", kind: "AGENDA" },
      { title: "הריאיון", prompt: "שאלה טכנית או התנהגותית, לפי מה שסיכמתם מראש.", kind: "PROMPT" },
      { title: "משוב הדדי", prompt: "מה עבד טוב? מה הייתם ממליצים לשפר?", kind: "FOLLOWUP" },
    ],
  });
}

interface GuideSeed {
  id: string;
  title: string;
  purpose: string;
  suggestedDurationMinutes: number;
  format: "ONE_ON_ONE" | "GROUP" | "BOTH";
  category: string;
  order: number;
  steps: { title: string; prompt: string; kind: "AGENDA" | "PROMPT" | "FOLLOWUP" }[];
}

async function upsertGuide(prisma: PrismaClient, input: GuideSeed) {
  const guide = await prisma.sessionGuide.upsert({
    where: { id: input.id },
    update: {},
    create: {
      id: input.id,
      title: input.title,
      purpose: input.purpose,
      suggestedDurationMinutes: input.suggestedDurationMinutes,
      format: input.format,
      category: input.category,
      order: input.order,
      status: "PUBLISHED",
    },
  });

  const existingSteps = await prisma.sessionGuideStep.count({ where: { guideId: guide.id } });
  if (existingSteps === 0) {
    await prisma.sessionGuideStep.createMany({
      data: input.steps.map((step, index) => ({ guideId: guide.id, order: index, ...step })),
    });
  }
}
