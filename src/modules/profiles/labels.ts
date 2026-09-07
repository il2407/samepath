// Hebrew display labels for enum values shown in match/connection UI.

export const connectionFormatLabels: Record<string, string> = {
  ONE_ON_ONE: "אחד על אחד",
  GROUP: "קבוצה קטנה",
  BOTH: "גמיש",
};

export const connectionCadenceLabels: Record<string, string> = {
  ONE_TIME: "חד-פעמי",
  RECURRING: "קבוע",
  BOTH: "גמיש",
};

export const connectionModeLabels: Record<string, string> = {
  ONLINE: "מקוון",
  IN_PERSON: "פרונטלי",
  BOTH: "גמיש",
};

/** The profile owner's own self-reported gender. */
export const genderLabels: Record<string, string> = {
  MALE: "גבר",
  FEMALE: "אישה",
};

/** Who the profile owner wants to be matched with, by gender. */
export const genderPreferenceLabels: Record<string, string> = {
  MALE: "גברים בלבד",
  FEMALE: "נשים בלבד",
  BOTH: "גם וגם",
};

export const connectionReasonLabels: Record<string, string> = {
  SHARE_JOB_SEARCH: "לשתף בתהליך החיפוש",
  ACCOUNTABILITY: "ליווי הדדי",
  PROFESSIONAL_DISCUSSION: "שיתוף תהליך וייעוץ",
  LEARNING_TOGETHER: "ללמוד יחד",
  INTRO_VIDEO_CALL: "פגישת היכרות בווידאו (להכיר לפני שממשיכים)",
  CODING_PRACTICE: "תרגול קוד",
  SYSTEM_DESIGN: "ראיון עיצוב מערכות מדומה",
  INTERVIEW_SIMULATION: "ראיון שאלות טכניות מדומה",
  PROJECT_PITCH: "פיצ'ינג פרויקט והצגה עצמית",
  BEHAVIORAL_INTERVIEW: "ראיון התנהגותי מדומה",
  MENTAL_SUPPORT: "תמיכה נפשית ורגשית",
  OTHER: "אחר",
};

/** The subset of ConnectionReason that represents a concrete session format/type,
 * as opposed to a general motivation for connecting (SHARE_JOB_SEARCH,
 * ACCOUNTABILITY, LEARNING_TOGETHER, OTHER). Used both for the profile-level
 * "session types" picker and the per-connection selector. */
export const sessionTypeReasons = [
  "INTRO_VIDEO_CALL",
  "INTERVIEW_SIMULATION",
  "BEHAVIORAL_INTERVIEW",
  "SYSTEM_DESIGN",
  "CODING_PRACTICE",
  "PROJECT_PITCH",
  "PROFESSIONAL_DISCUSSION",
  "MENTAL_SUPPORT",
] as const;

export const reportCategoryLabels: Record<string, string> = {
  SAFETY_CONCERN: "חשש לבטיחות",
  HARASSMENT: "הטרדה",
  SPAM: "ספאם",
  FAKE_PROFILE: "פרופיל מזויף",
  PRIVACY_CONCERN: "חשש לפרטיות",
  NO_SHOW: "לא הגיע/ה לפגישה",
  OTHER: "אחר",
};
