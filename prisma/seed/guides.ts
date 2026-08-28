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

  await seedPracticeSessionGuides(prisma);
}

/**
 * Structured, timed practice-session walkthroughs (project/architecture
 * presentation, coding, system design) — suggested at the point a
 * connection is set up (src/modules/connections/ConnectionRoom.tsx) so
 * both people know what shape the session will take before it starts,
 * rather than leaving it to whoever talks first. Still fully optional,
 * same as every other guide: nothing here is tracked for completion or
 * required to use a connection.
 *
 * These are seeded starter content, not a curated bank — see README for
 * how to add more via /admin/guides (category "coding" / "system-design"
 * / "project-presentation" — the suggestion logic on a connection picks a
 * random PUBLISHED guide from whichever category the pair chooses).
 */
async function seedPracticeSessionGuides(prisma: PrismaClient) {
  await upsertGuide(prisma, {
    id: "seed-guide-practice-project-presentation",
    title: "הצגת פרויקט וארכיטקטורה",
    purpose:
      "מבנה מוצע להצגה הדדית של פרויקט שעבדתם עליו — קבוע מראש כדי ששניכם תדעו למה לצפות ותצאו עם ערך אמיתי, לא רק שיחה שמישהו לוקח לעצמו.",
    suggestedDurationMinutes: 40,
    format: "ONE_ON_ONE",
    category: "project-presentation",
    order: 10,
    steps: [
      { title: "קביעת סדר", prompt: "קבעו מי מציג/ה קודם — אין קריטריון מיוחד, פשוט תחליטו.", kind: "AGENDA", role: "BOTH", durationMinutes: 1 },
      {
        title: "הצגת הפרויקט",
        prompt: "הציגו פרויקט שעבדתם עליו: הבעיה שהוא פותר, הארכיטקטורה הכללית, וההחלטות הטכניות המרכזיות שקיבלתם.",
        kind: "PROMPT",
        role: "PRESENTER",
        durationMinutes: 8,
      },
      {
        title: "הקשבה ושאלות",
        prompt:
          "הקשיבו ושאלו שאלות מבהירות. כיוונים שיכולים לעזור: מה היה האתגר הטכני הכי גדול? איפה היו צווארי הבקבוק? מה הייתם עושים אחרת היום? איך הייתם מרחיבים את זה פי 10? איך התמודדתם עם כשלים ומקרי קצה?",
        kind: "AGENDA",
        role: "LISTENER",
        durationMinutes: 8,
      },
      {
        title: "רפלקציה נפרדת",
        prompt: "המקשיב/ה: רשמו משוב קצר על ההצגה. המציג/ה: רשמו לעצמכם מה היה כדאי להבהיר יותר.",
        kind: "PROMPT",
        role: "BOTH",
        durationMinutes: 4,
      },
      { title: "החלפת תפקידים", prompt: "עכשיו תורכם — מי שהקשיב/ה מציג/ה.", kind: "AGENDA", role: "BOTH", durationMinutes: 0 },
      {
        title: "הצגת הפרויקט (סבב שני)",
        prompt: "הציגו פרויקט שעבדתם עליו: הבעיה שהוא פותר, הארכיטקטורה הכללית, וההחלטות הטכניות המרכזיות שקיבלתם.",
        kind: "PROMPT",
        role: "PRESENTER",
        durationMinutes: 8,
      },
      {
        title: "הקשבה ושאלות (סבב שני)",
        prompt:
          "הקשיבו ושאלו שאלות מבהירות. כיוונים שיכולים לעזור: מה היה האתגר הטכני הכי גדול? איפה היו צווארי הבקבוק? מה הייתם עושים אחרת היום? איך הייתם מרחיבים את זה פי 10? איך התמודדתם עם כשלים ומקרי קצה?",
        kind: "AGENDA",
        role: "LISTENER",
        durationMinutes: 8,
      },
      {
        title: "רפלקציה נפרדת (סבב שני)",
        prompt: "המקשיב/ה: רשמו משוב קצר על ההצגה. המציג/ה: רשמו לעצמכם מה היה כדאי להבהיר יותר.",
        kind: "PROMPT",
        role: "BOTH",
        durationMinutes: 4,
      },
    ],
  });

  const codingQuestions: { slug: string; title: string; prompt: string }[] = [
    {
      slug: "two-sum",
      title: "Two Sum",
      prompt:
        "בהינתן מערך מספרים שלמים ומספר יעד, מצאו את האינדקסים של שני איברים שסכומם שווה ליעד. אפשר להניח שיש פתרון יחיד, ואי אפשר להשתמש באותו איבר פעמיים.",
    },
    {
      slug: "reverse-linked-list",
      title: "Reverse a Linked List",
      prompt:
        "בהינתן הראש של רשימה מקושרת חד-כיוונית, הפכו את סדר האיברים והחזירו את הראש החדש. נסו לפתור גם באופן איטרטיבי וגם רקורסיבי, ודונו בהבדל ביניהם.",
    },
    {
      slug: "valid-parentheses",
      title: "Valid Parentheses",
      prompt:
        "בהינתן מחרוזת המכילה רק את התווים ()[]{}, קבעו אם הסוגריים במחרוזת תקינים ומאוזנים כראוי (כל סוגר נסגר בסדר הנכון).",
    },
    {
      slug: "merge-intervals",
      title: "Merge Intervals",
      prompt:
        "בהינתן מערך של קטעים [start, end], מזגו את כל הקטעים החופפים והחזירו מערך של קטעים שאינם חופפים, המכסה את כל הטווחים המקוריים.",
    },
    {
      slug: "lru-cache",
      title: "LRU Cache",
      prompt:
        "תכננו ומימשו מבנה נתונים של LRU Cache עם קיבולת קבועה, התומך בפעולות get ו-put בסיבוכיות זמן ריצה O(1) בממוצע לפעולה.",
    },
    {
      slug: "number-of-islands",
      title: "Number of Islands",
      prompt:
        "בהינתן מטריצת 0/1 דו-ממדית המייצגת מפה, ספרו כמה \"איים\" (קבוצות מחוברות של תאי 1) יש במפה. שני תאים נחשבים מחוברים אם הם שכנים אנכית או אופקית.",
    },
  ];

  for (const [index, question] of codingQuestions.entries()) {
    await upsertGuide(prisma, {
      id: `seed-guide-practice-coding-${question.slug}`,
      title: `תרגול קוד: ${question.title}`,
      purpose: "פתרון משותף של בעיית קוד — לא ראיון, אלא הזדמנות לחשוב יחד ולדון בגישות שונות.",
      suggestedDurationMinutes: 35,
      format: "BOTH",
      category: "coding",
      order: 20 + index,
      steps: [
        {
          title: "גישה ראשונית",
          prompt: "קראו את השאלה יחד. לפני שכותבים קוד, דברו על גישה אפשרית ועל סיבוכיות משוערת.",
          kind: "AGENDA",
          role: "BOTH",
          durationMinutes: 3,
        },
        { title: "פתרון משותף", prompt: question.prompt, kind: "PROMPT", role: "BOTH", durationMinutes: 20 },
        {
          title: "דיון בטרייד-אופים",
          prompt: "מה הסיבוכיות בזמן ובזיכרון של הפתרון? יש גישה יעילה יותר? מה הייתם משנים לקראת production?",
          kind: "PROMPT",
          role: "BOTH",
          durationMinutes: 7,
        },
        {
          title: "רפלקציה אישית",
          prompt: "כל אחד/ת כותב/ת לעצמו: מה למדתי? מה הייתי רוצה לתרגל עוד?",
          kind: "PROMPT",
          role: "BOTH",
          durationMinutes: 5,
        },
      ],
    });
  }

  const systemDesignQuestions: { slug: string; title: string; prompt: string }[] = [
    { slug: "url-shortener", title: "מקצר קישורים", prompt: "עצבו מערכת המקצרת כתובות URL ארוכות לכתובות קצרות (כמו bit.ly), כולל הפניה מהירה מהכתובת הקצרה למקורית." },
    { slug: "rate-limiter", title: "Rate Limiter", prompt: "עצבו rate limiter שמגביל את מספר הבקשות שמשתמש יכול לשלוח למערכת בחלון זמן נתון." },
    { slug: "news-feed", title: "פיד חדשות", prompt: "עצבו את הליבה של פיד חדשות (כמו טוויטר או פייסבוק) שמציג פוסטים מאנשים שאתם עוקבים אחריהם, ממוין לפי זמן." },
    { slug: "notification-system", title: "מערכת התראות", prompt: "עצבו מערכת התראות שיכולה לשלוח הודעות (push, מייל, SMS) למיליוני משתמשים באמינות." },
    { slug: "chat-app", title: "אפליקציית צ'אט", prompt: "עצבו אפליקציית צ'אט (כמו WhatsApp) התומכת בהודעות בזמן אמת בין שני משתמשים או יותר." },
    { slug: "web-crawler", title: "Web Crawler", prompt: "עצבו web crawler שסורק ומאנדקס דפי אינטרנט בקנה מידה גדול, תוך כיבוד robots.txt והימנעות מכפילויות." },
    { slug: "parking-garage", title: "חניון רב-קומתי", prompt: "עצבו מערכת לניהול חניון רב-קומתי: הקצאת מקומות חניה, תשלום, ומעקב אחר תפוסה בזמן אמת." },
    { slug: "distributed-cache", title: "מטמון מבוזר", prompt: "עצבו מטמון מבוזר (distributed cache) התומך בקריאה וכתיבה מהירות ועקביות בין מספר שרתים." },
    { slug: "ecommerce-checkout", title: "קופה ומלאי לחנות מקוונת", prompt: "עצבו את מערכת התשלום והמלאי של חנות מקוונת, כולל מניעת מכירת פריט שאזל מהמלאי בו-זמנית משני משתמשים." },
    { slug: "ride-sharing", title: "שידוך נהג-נוסע", prompt: "עצבו מערכת שידוך נהג-נוסע (כמו Uber): איך המערכת מוצאת ומשייכת את הנהג הקרוב ביותר בזמן אמת." },
  ];

  const pairs: [number, number][] = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [8, 9],
  ];

  for (const [index, [aIdx, bIdx]] of pairs.entries()) {
    const qA = systemDesignQuestions[aIdx];
    const qB = systemDesignQuestions[bIdx];
    await upsertGuide(prisma, {
      id: `seed-guide-practice-system-design-${index + 1}`,
      title: `עיצוב מערכות: ${qA.title} ו${qB.title}`,
      purpose: "כל אחד/ת מקבל/ת אתגר עיצוב שונה, מציג/ה את החשיבה, והצד השני שואל ונותן משוב — לא ראיון, תרגול הדדי.",
      suggestedDurationMinutes: 60,
      format: "ONE_ON_ONE",
      category: "system-design",
      order: 30 + index,
      steps: buildSystemDesignSteps(qA.prompt, qB.prompt),
    });
  }
}

function buildSystemDesignSteps(promptA: string, promptB: string): GuideStepSeed[] {
  const listenerPrompt =
    "הקשיבו ושאלו שאלות: איך המערכת מתמודדת עם עומס? מה קורה כשרכיב נכשל? איפה צווארי הבקבוק האפשריים?";
  const reflectPrompt = "רישום נפרד: המציג/ה כותב/ת רפלקציה אישית. המקשיב/ה כותב/ת משוב על הפתרון שהוצג.";

  return [
    { title: "קביעת סדר", prompt: "קבעו מי מתחיל/ה. כל אחד/ת יעבוד על אתגר עיצוב שונה.", kind: "AGENDA", role: "BOTH", durationMinutes: 2 },
    { title: "הצגת הפתרון", prompt: `${promptA} הסבירו את תהליך החשיבה שלכם תוך כדי עיצוב הפתרון — דרישות, קנה מידה, ארכיטקטורה ברמה גבוהה.`, kind: "PROMPT", role: "PRESENTER", durationMinutes: 12 },
    { title: "הקשבה ושאלות", prompt: listenerPrompt, kind: "AGENDA", role: "LISTENER", durationMinutes: 12 },
    { title: "רישום נפרד", prompt: reflectPrompt, kind: "PROMPT", role: "BOTH", durationMinutes: 5 },
    { title: "החלפת תפקידים ואתגר חדש", prompt: "עכשיו תורכם — עם אתגר עיצוב שונה מזה שהוצג קודם.", kind: "AGENDA", role: "BOTH", durationMinutes: 0 },
    { title: "הצגת הפתרון (אתגר שני)", prompt: `${promptB} הסבירו את תהליך החשיבה שלכם תוך כדי עיצוב הפתרון — דרישות, קנה מידה, ארכיטקטורה ברמה גבוהה.`, kind: "PROMPT", role: "PRESENTER", durationMinutes: 12 },
    { title: "הקשבה ושאלות (סבב שני)", prompt: listenerPrompt, kind: "AGENDA", role: "LISTENER", durationMinutes: 12 },
    { title: "רישום נפרד (סבב שני)", prompt: reflectPrompt, kind: "PROMPT", role: "BOTH", durationMinutes: 5 },
  ];
}

interface GuideStepSeed {
  title: string;
  prompt: string;
  kind: "AGENDA" | "PROMPT" | "FOLLOWUP";
  role?: "PRESENTER" | "LISTENER" | "BOTH";
  durationMinutes?: number;
}

interface GuideSeed {
  id: string;
  title: string;
  purpose: string;
  suggestedDurationMinutes: number;
  format: "ONE_ON_ONE" | "GROUP" | "BOTH";
  category: string;
  order: number;
  steps: GuideStepSeed[];
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
