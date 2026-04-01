/** Deterministic 32-bit hash for picking spines from the same inputs. */
export function hashString(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return h | 0;
}
