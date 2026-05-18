/// Deterministic seed from image bytes for mock providers.
int seedFromImageBytes(List<int> bytes) {
  if (bytes.isEmpty) return 42;
  return bytes.fold(0, (hash, byte) => (hash * 31 + byte) & 0x7fffffff);
}
