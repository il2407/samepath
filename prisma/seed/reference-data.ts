import { PrismaClient } from "@/generated/prisma/client";

/**
 * Reference/lookup rows. Deliberately data, not enums, per the spec's
 * extensibility requirement — adding a profession, role, band, language, or
 * region later is an admin edit, not a migration. v1 markets narrowly to
 * backend/backend-oriented-fullstack, but nothing here hard-codes that
 * narrowness into the schema or the seed.
 */
export async function seedReferenceData(prisma: PrismaClient) {
  const fields = [
    { code: "software-engineering", labelHe: "הנדסת תוכנה", labelEn: "Software Engineering", sortOrder: 0 },
    { code: "data", labelHe: "דאטה", labelEn: "Data", sortOrder: 1 },
    { code: "product", labelHe: "מוצר", labelEn: "Product", sortOrder: 2 },
    { code: "design", labelHe: "עיצוב", labelEn: "Design", sortOrder: 3 },
  ];
  for (const field of fields) {
    await prisma.professionalField.upsert({ where: { code: field.code }, update: field, create: field });
  }
  const softwareField = await prisma.professionalField.findUniqueOrThrow({
    where: { code: "software-engineering" },
  });

  const targetRoles = [
    { code: "backend-developer", labelHe: "מפתח/ת Backend", labelEn: "Backend Developer", sortOrder: 0 },
    {
      code: "fullstack-backend-oriented",
      labelHe: "Full Stack (מוטה Backend)",
      labelEn: "Full Stack (Backend-oriented)",
      sortOrder: 1,
    },
    { code: "devops-engineer", labelHe: "מהנדס/ת DevOps", labelEn: "DevOps Engineer", sortOrder: 2 },
    { code: "data-engineer", labelHe: "מהנדס/ת דאטה", labelEn: "Data Engineer", sortOrder: 3 },
    { code: "frontend-developer", labelHe: "מפתח/ת Frontend", labelEn: "Frontend Developer", sortOrder: 4 },
    { code: "mobile-developer", labelHe: "מפתח/ת מובייל", labelEn: "Mobile Developer", sortOrder: 5 },
    { code: "qa-engineer", labelHe: "מהנדס/ת QA", labelEn: "QA Engineer", sortOrder: 6 },
    {
      code: "engineering-manager",
      labelHe: "ראש צוות / מנהל/ת הנדסה",
      labelEn: "Engineering Manager",
      sortOrder: 7,
    },
  ];
  for (const role of targetRoles) {
    await prisma.targetRole.upsert({
      where: { code: role.code },
      update: { ...role, professionalFieldId: softwareField.id },
      create: { ...role, professionalFieldId: softwareField.id },
    });
  }

  const seniorityBands = [
    { code: "junior", labelHe: "ג׳וניור (0–2 שנים)", labelEn: "Junior (0–2y)", minMonths: 0, maxMonths: 23, sortOrder: 0 },
    { code: "mid", labelHe: "מידלוול (2–5 שנים)", labelEn: "Mid-level (2–5y)", minMonths: 24, maxMonths: 59, sortOrder: 1 },
    { code: "senior", labelHe: "סניור (5–8 שנים)", labelEn: "Senior (5–8y)", minMonths: 60, maxMonths: 95, sortOrder: 2 },
    { code: "staff", labelHe: "סטאף/פרינסיפל (8+ שנים)", labelEn: "Staff/Principal (8y+)", minMonths: 96, maxMonths: null, sortOrder: 3 },
  ];
  for (const band of seniorityBands) {
    await prisma.seniorityBand.upsert({ where: { code: band.code }, update: band, create: band });
  }

  const languages = [
    { code: "he", labelHe: "עברית", labelEn: "Hebrew" },
    { code: "en", labelHe: "אנגלית", labelEn: "English" },
    { code: "ar", labelHe: "ערבית", labelEn: "Arabic" },
    { code: "ru", labelHe: "רוסית", labelEn: "Russian" },
  ];
  for (const language of languages) {
    await prisma.language.upsert({ where: { code: language.code }, update: language, create: language });
  }

  const regions = [
    { code: "il", labelHe: "ישראל", labelEn: "Israel", kind: "COUNTRY" },
    { code: "il-center", labelHe: "מרכז", labelEn: "Center", kind: "BROAD_AREA" },
    { code: "il-tel-aviv", labelHe: "תל אביב והסביבה", labelEn: "Tel Aviv area", kind: "BROAD_AREA" },
    { code: "il-jerusalem", labelHe: "ירושלים והסביבה", labelEn: "Jerusalem area", kind: "BROAD_AREA" },
    { code: "il-haifa-north", labelHe: "חיפה והצפון", labelEn: "Haifa & North", kind: "BROAD_AREA" },
    { code: "il-south", labelHe: "דרום", labelEn: "South", kind: "BROAD_AREA" },
    { code: "remote", labelHe: "מרוחק / גמיש", labelEn: "Remote / flexible", kind: "BROAD_AREA" },
  ];
  for (const region of regions) {
    await prisma.region.upsert({ where: { code: region.code }, update: region, create: region });
  }

  const skills = [
    "Java",
    "Python",
    "Node.js",
    "TypeScript",
    "Go",
    "C#",
    ".NET",
    "Spring",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Redis",
    "Kafka",
    "RabbitMQ",
    "Docker",
    "Kubernetes",
    "AWS",
    "GCP",
    "Azure",
    "System Design",
    "Microservices",
    "REST APIs",
    "GraphQL",
    "CI/CD",
  ];
  for (const name of skills) {
    const slug = slugify(name);
    await prisma.tag.upsert({
      where: { kind_slug: { kind: "SKILL", slug } },
      update: { labelHe: name, labelEn: name },
      create: { kind: "SKILL", slug, labelHe: name, labelEn: name },
    });
  }

  const domains: [string, string][] = [
    ["Fintech", "פינטק"],
    ["E-commerce", "מסחר אלקטרוני"],
    ["Healthtech", "הלת׳-טק"],
    ["Cybersecurity", "סייבר"],
    ["AdTech", "אד-טק"],
    ["Gaming", "גיימינג"],
    ["Enterprise SaaS", "SaaS ארגוני"],
    ["Government / Public Sector", "ממשלתי / ציבורי"],
  ];
  for (const [labelEn, labelHe] of domains) {
    const slug = slugify(labelEn);
    await prisma.tag.upsert({
      where: { kind_slug: { kind: "DOMAIN", slug } },
      update: { labelHe, labelEn },
      create: { kind: "DOMAIN", slug, labelHe, labelEn },
    });
  }

  const topics: [string, string][] = [
    ["Algorithms", "אלגוריתמים"],
    ["System Design", "עיצוב מערכות"],
    ["Behavioral", "שאלות התנהגותיות"],
    ["SQL", "SQL"],
    ["Concurrency", "תכנות מקבילי"],
    ["API Design", "עיצוב API"],
    ["Databases", "בסיסי נתונים"],
    ["Distributed Systems", "מערכות מבוזרות"],
  ];
  for (const [labelEn, labelHe] of topics) {
    const slug = slugify(labelEn);
    await prisma.tag.upsert({
      where: { kind_slug: { kind: "TOPIC", slug } },
      update: { labelHe, labelEn },
      create: { kind: "TOPIC", slug, labelHe, labelEn },
    });
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
