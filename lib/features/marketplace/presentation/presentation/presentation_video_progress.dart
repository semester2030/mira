/// Shared bounded check for real playback advancement (used by integration tests).
bool videoPositionShowsProgress(List<Duration> samples) {
  if (samples.length < 2) return false;
  for (var i = 1; i < samples.length; i++) {
    if (samples[i] != samples[i - 1]) return true;
  }
  return false;
}
