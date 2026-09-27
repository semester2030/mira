import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

import 'datasources/marketplace_api_data_source.dart';

class FavoriteAuthException implements Exception {
  const FavoriteAuthException();
}

class FavoriteMissingException implements Exception {
  const FavoriteMissingException();
}

class FavoriteStaleException implements Exception {
  const FavoriteStaleException();
}

abstract class DiscoverFavoriteTransport {
  Future<Set<String>> listFavoriteKeys();
  Future<void> setFavorite({required String kind, required String id, required bool saved});
}

class ApiDiscoverFavoriteTransport implements DiscoverFavoriteTransport {
  ApiDiscoverFavoriteTransport(this._api);

  final MarketplaceApiDataSource _api;

  @override
  Future<Set<String>> listFavoriteKeys() => _api.listFavoriteKeys();

  @override
  Future<void> setFavorite({required String kind, required String id, required bool saved}) {
    return _api.setFavorite(kind: kind, id: id, saved: saved);
  }
}

/// Saved catalog rows for the signed-in Mira account. The server reads the user from the token.
abstract class DiscoverFavoriteClient extends ChangeNotifier {
  String? get accountKey;
  bool saved(String kind, String id);
  bool saving(String kind, String id);
  bool get readFailed;
  Future<void> refresh();
  Future<bool> toggle({required String kind, required String id});
  Future<void> set({required String kind, required String id, required bool saved});
}

class ApiDiscoverFavoriteClient extends DiscoverFavoriteClient {
  ApiDiscoverFavoriteClient({
    MarketplaceApiDataSource? api,
    DiscoverFavoriteTransport? transport,
    Stream<String?>? accounts,
  }) : _transport = transport ?? ApiDiscoverFavoriteTransport(api ?? MarketplaceApiDataSource()) {
    if (accounts != null) {
      _bind(accounts);
    } else if (_firebaseReady) {
      _bind(FirebaseAuth.instance.authStateChanges().map((user) => user?.uid));
    }
  }

  final DiscoverFavoriteTransport _transport;
  StreamSubscription<String?>? _auth;
  String? _account;
  var _generation = 0;
  var _writeSerial = 0;
  var _revision = 0;
  var _readSerial = 0;
  var _disposed = false;
  var _readFailed = false;
  final _saved = <String>{};
  final _saving = <String, int>{};

  @override
  String? get accountKey => _account;

  @override
  bool get readFailed => _readFailed;

  @override
  bool saved(String kind, String id) => _saved.contains('$kind:$id');

  @override
  bool saving(String kind, String id) => _saving.containsKey('$kind:$id');

  bool get _firebaseReady {
    try {
      return Firebase.apps.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  void _bind(Stream<String?> accounts) {
    _auth = accounts.listen((uid) {
      if (_disposed) return;
      _generation++;
      _writeSerial++;
      _revision++;
      _readSerial++;
      _account = uid;
      _saved.clear();
      _saving.clear();
      _readFailed = false;
      notifyListeners();
      if (uid != null) unawaited(refresh());
    });
  }

  bool _current(int generation, String? account) {
    return !_disposed && generation == _generation && account == _account;
  }

  bool _freshRead(int generation, String? account, int revision, int readId) {
    return _current(generation, account) && revision == _revision && readId == _readSerial;
  }

  @override
  Future<void> refresh() async {
    final generation = _generation;
    final account = _account;
    final revision = _revision;
    final readId = ++_readSerial;
    if (account == null) {
      if (_freshRead(generation, account, revision, readId) && (_saved.isNotEmpty || _readFailed)) {
        _saved.clear();
        _readFailed = false;
        notifyListeners();
      }
      return;
    }
    try {
      final keys = await _transport.listFavoriteKeys();
      if (!_freshRead(generation, account, revision, readId)) return;
      _saved
        ..clear()
        ..addAll(keys);
      _readFailed = false;
    } on FavoriteAuthException {
      if (!_freshRead(generation, account, revision, readId)) return;
      _saved.clear();
      _readFailed = true;
    } catch (_) {
      if (!_freshRead(generation, account, revision, readId)) return;
      _readFailed = true;
    }
    if (_freshRead(generation, account, revision, readId)) notifyListeners();
  }

  @override
  Future<bool> toggle({required String kind, required String id}) {
    final desired = !saved(kind, id);
    return set(kind: kind, id: id, saved: desired).then((_) => desired);
  }

  @override
  Future<void> set({required String kind, required String id, required bool saved}) async {
    final generation = _generation;
    final account = _account;
    if (account == null) throw const FavoriteAuthException();
    final key = '$kind:$id';
    final op = ++_writeSerial;
    _revision++;
    _saving[key] = op;
    if (!_disposed) notifyListeners();
    try {
      await _transport.setFavorite(kind: kind, id: id, saved: saved);
      if (!_current(generation, account)) throw const FavoriteStaleException();
      if (saved) {
        _saved.add(key);
      } else {
        _saved.remove(key);
      }
      _revision++;
      _readFailed = false;
    } on FavoriteStaleException {
      rethrow;
    } catch (error) {
      if (!_current(generation, account)) throw const FavoriteStaleException();
      rethrow;
    } finally {
      if (_saving[key] == op) _saving.remove(key);
      if (_current(generation, account)) notifyListeners();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    _auth?.cancel();
    super.dispose();
  }
}
