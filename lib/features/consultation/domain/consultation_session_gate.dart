/// A consultation turn can carry images only after a real session id exists.
bool consultationSessionReady({required bool markedReady, required String? sessionId}) {
  return markedReady && sessionId != null && sessionId.isNotEmpty;
}

/// Older pages are prepended. A message id already on screen is not repeated.
List<T> prependOlderMessages<T>(List<T> older, List<T> current, String? Function(T item) idOf) {
  final known = current.map(idOf).whereType<String>().toSet();
  return [
    ...older.where((item) {
      final id = idOf(item);
      return id == null || !known.contains(id);
    }),
    ...current,
  ];
}
