import { hashString } from "@/shared/hash";

/**
 * Word bank for auto-generated pre-match nicknames — replaces free-text
 * aliases (users used to type things like "מ." or a single blunt phrase)
 * with a friendlier, still fully anonymous "[Trait] [Object] [number]"
 * persona name, the same idea as Google Docs'/Meet's anonymous-collaborator
 * names (e.g. "Anonymous Panda 42"). English and numeric on purpose — reads
 * the same regardless of the viewer's language, and the trailing number
 * keeps two candidates with the same trait+object pair visibly distinct.
 * Deliberately neutral objects/nature nouns rather than professions or
 * animals, so no combination reads as gendered or as an accidental hint
 * about the person.
 */
const TRAITS = [
  "Curious",
  "Eager",
  "Steady",
  "Determined",
  "Lively",
  "Quiet",
  "Careful",
  "Bold",
  "Precise",
  "Creative",
  "Consistent",
  "Practical",
  "Sharp",
  "Calm",
  "Pioneering",
];

const OBJECTS = [
  "Compass",
  "Lantern",
  "Bridge",
  "Anchor",
  "Spark",
  "Horizon",
  "Trail",
  "Lighthouse",
  "Leaf",
  "Star",
  "Stream",
  "Summit",
  "Wave",
  "Cliff",
  "Brook",
];

/** Same seed always yields the same nickname; omit the seed for a fresh random pick (e.g. a "shuffle" button). */
export function generateFriendlyNickname(seed?: string): string {
  const value = seed ?? `${Date.now()}-${Math.random()}`;
  const hash = hashString(value);
  const trait = TRAITS[hash % TRAITS.length];
  const object = OBJECTS[Math.floor(hash / TRAITS.length) % OBJECTS.length];
  const number = 10 + (hashString(`number:${value}`) % 90); // stable 2-digit tag, e.g. "Curious Compass 84"
  return `${trait} ${object} ${number}`;
}
