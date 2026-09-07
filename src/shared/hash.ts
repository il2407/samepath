/** Deterministic, non-cryptographic string hash (djb2 variant) — used to derive a stable pick (an avatar shade, a nickname) from a seed string, never for anything security-sensitive. */
export function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}
