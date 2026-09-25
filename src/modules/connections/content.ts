export interface PracticeContent {
  key: string;
  title: string;
  purpose: string;
  href: string;
  minutes?: number;
  level?: string;
}

export interface SharedPractice {
  pending: PracticeContent | null;
  agreed: PracticeContent | null;
  proposedBy: string | null;
  revision: number;
}

export function practiceStatus(
  practice: SharedPractice | undefined,
  userId: string,
) {
  if (practice?.pending)
    return practice.proposedBy === userId
      ? { label: "ממתינים לאישור התוכן", action: "לשיחה ולפרטי ההצעה" }
      : { label: "הוצע תוכן — מחכה לתגובה שלך", action: "לבחינת התוכן" };
  if (practice?.agreed)
    return { label: "התוכן למפגש אושר", action: "לפתיחת המפגש" };
  return { label: "אפשר להתחיל שיחה", action: "להיכרות ולשיחה" };
}

export function contentHref(content: PracticeContent, connectionId: string) {
  return `${content.href}${content.href.includes("?") ? "&" : "?"}connection=${encodeURIComponent(connectionId)}`;
}
