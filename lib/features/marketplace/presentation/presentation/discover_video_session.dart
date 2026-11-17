import 'presentation_video_port.dart';

/// Process-wide Discover video port so parking/prepared decoders survive
/// Navigator pop/push between orbit lanes (أناقتك ↔ المجوهرات).
///
/// Section screens must call [leaveSection] on dispose instead of
/// [AssetVideoPort.release]/[AssetVideoPort.dispose] when using [port].
class DiscoverVideoSession {
  DiscoverVideoSession._();

  static final DiscoverVideoSession instance = DiscoverVideoSession._();

  AssetVideoPort? _port;

  /// Shared player used by every DiscoverPresentationScreen that does not
  /// inject its own [PresentationVideoPort] (tests still inject).
  AssetVideoPort get port => _port ??= AssetVideoPort();

  /// Pause/park the active clip and pin its bytes — keep prepared pool alive.
  Future<void> leaveSection() => port.leaveSection();
}
