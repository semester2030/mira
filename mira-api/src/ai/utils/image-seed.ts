export function seedFromImageBytes(bytes: Buffer): number {
  if (bytes.length === 0) return 42;
  let hash = 0;
  for (const byte of bytes) {
    hash = (hash * 31 + byte) & 0x7fffffff;
  }
  return hash;
}

/** Deterministic pseudo-random in [0, max) from seed state. */
export function nextInt(state: { seed: number }, max: number): number {
  state.seed = (state.seed * 1103515245 + 12345) & 0x7fffffff;
  return state.seed % max;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
