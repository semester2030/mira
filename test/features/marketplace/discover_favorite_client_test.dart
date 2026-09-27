import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/discover_favorite_client.dart';

void main() {
  test('a late refresh for account A does not write account B', () async {
    final transport = _ScriptedTransport();
    final accounts = StreamController<String?>();
    final client = ApiDiscoverFavoriteClient(transport: transport, accounts: accounts.stream);
    accounts.add('A');
    await Future<void>.delayed(Duration.zero);
    final refresh = transport.pendingLists.single;
    accounts.add('B');
    await Future<void>.delayed(Duration.zero);
    refresh.complete({'product:old'});
    await Future<void>.delayed(Duration.zero);
    expect(client.accountKey, 'B');
    expect(client.saved('product', 'old'), isFalse);
    client.dispose();
    await accounts.close();
  });

  test('logout during a save drops the previous account and ignores its result', () async {
    final transport = _ScriptedTransport();
    final accounts = StreamController<String?>();
    final client = ApiDiscoverFavoriteClient(transport: transport, accounts: accounts.stream);
    accounts.add('A');
    await Future<void>.delayed(Duration.zero);
    transport.pendingLists.single.complete(<String>{});
    await Future<void>.delayed(Duration.zero);
    final save = client.set(kind: 'product', id: 'p1', saved: true);
    accounts.add(null);
    transport.pendingSets.single.complete();
    await expectLater(save, throwsA(isA<FavoriteStaleException>()));
    expect(client.accountKey, isNull);
    expect(client.saved('product', 'p1'), isFalse);
    client.dispose();
    await accounts.close();
  });

  test('dispose during a request does not notify afterwards', () async {
    final transport = _ScriptedTransport();
    final accounts = StreamController<String?>();
    final client = ApiDiscoverFavoriteClient(transport: transport, accounts: accounts.stream);
    var notifications = 0;
    client.addListener(() => notifications++);
    accounts.add('A');
    await Future<void>.delayed(Duration.zero);
    final before = notifications;
    client.dispose();
    transport.pendingLists.single.complete({'product:p1'});
    await Future<void>.delayed(Duration.zero);
    expect(notifications, before);
    await accounts.close();
  });

  test('an older refresh does not replace a newer save', () async {
    final transport = _ScriptedTransport();
    final accounts = StreamController<String?>();
    final client = ApiDiscoverFavoriteClient(transport: transport, accounts: accounts.stream);
    accounts.add('A');
    await Future<void>.delayed(Duration.zero);
    final refresh = transport.pendingLists.single;
    final save = client.set(kind: 'product', id: 'p1', saved: true);
    transport.pendingSets.single.complete();
    await save;
    refresh.complete(<String>{});
    await Future<void>.delayed(Duration.zero);
    expect(client.saved('product', 'p1'), isTrue);
    client.dispose();
    await accounts.close();
  });

  test('a failed read stays failed until retry succeeds', () async {
    final transport = _ScriptedTransport(failList: true);
    final accounts = StreamController<String?>();
    final client = ApiDiscoverFavoriteClient(transport: transport, accounts: accounts.stream);
    accounts.add('A');
    await Future<void>.delayed(Duration.zero);
    expect(client.readFailed, isTrue);
    expect(client.saved('product', 'p1'), isFalse);
    transport.failList = false;
    final retry = client.refresh();
    transport.pendingLists.single.complete({'product:p1'});
    await retry;
    expect(client.readFailed, isFalse);
    expect(client.saved('product', 'p1'), isTrue);
    client.dispose();
    await accounts.close();
  });

  test('signing in again restores that account favorites', () async {
    final transport = _ScriptedTransport();
    final accounts = StreamController<String?>();
    final client = ApiDiscoverFavoriteClient(transport: transport, accounts: accounts.stream);
    accounts.add('A');
    await Future<void>.delayed(Duration.zero);
    transport.pendingLists.single.complete({'product:p1'});
    await Future<void>.delayed(Duration.zero);
    accounts.add(null);
    await Future<void>.delayed(Duration.zero);
    accounts.add('A');
    await Future<void>.delayed(Duration.zero);
    transport.pendingLists.last.complete({'product:p1'});
    await Future<void>.delayed(Duration.zero);
    expect(client.saved('product', 'p1'), isTrue);
    client.dispose();
    await accounts.close();
  });

  test('repeating the same save request stays saved', () async {
    final transport = _ScriptedTransport();
    final accounts = StreamController<String?>();
    final client = ApiDiscoverFavoriteClient(transport: transport, accounts: accounts.stream);
    accounts.add('A');
    await Future<void>.delayed(Duration.zero);
    transport.pendingLists.last.complete(<String>{});
    await Future<void>.delayed(Duration.zero);
    final first = client.set(kind: 'product', id: 'p1', saved: true);
    transport.pendingSets.single.complete();
    await first;
    final second = client.set(kind: 'product', id: 'p1', saved: true);
    transport.pendingSets.last.complete();
    await second;
    expect(transport.savedCalls.where((call) => call.saved).length, 2);
    expect(client.saved('product', 'p1'), isTrue);
    client.dispose();
    await accounts.close();
  });

  test('a late 401 does not clear a newer save or show a stale error', () async {
    final transport = _ScriptedTransport();
    final accounts = StreamController<String?>();
    final client = ApiDiscoverFavoriteClient(transport: transport, accounts: accounts.stream);
    accounts.add('A');
    await Future<void>.delayed(Duration.zero);
    final stale = transport.pendingLists.last;
    final save = client.set(kind: 'product', id: 'p1', saved: true);
    transport.pendingSets.last.complete();
    await save;
    stale.completeError(const FavoriteAuthException());
    await Future<void>.delayed(Duration.zero);
    expect(client.saved('product', 'p1'), isTrue);
    expect(client.readFailed, isFalse);
    client.dispose();
    await accounts.close();
  });

  test('a late network error does not clear a newer save', () async {
    final transport = _ScriptedTransport();
    final accounts = StreamController<String?>();
    final client = ApiDiscoverFavoriteClient(transport: transport, accounts: accounts.stream);
    accounts.add('A');
    await Future<void>.delayed(Duration.zero);
    final stale = transport.pendingLists.last;
    final save = client.set(kind: 'product', id: 'p1', saved: true);
    transport.pendingSets.last.complete();
    await save;
    stale.completeError(Exception('network'));
    await Future<void>.delayed(Duration.zero);
    expect(client.saved('product', 'p1'), isTrue);
    expect(client.readFailed, isFalse);
    client.dispose();
    await accounts.close();
  });

  test('a read started during a pending write does not overwrite that write', () async {
    final transport = _ScriptedTransport();
    final accounts = StreamController<String?>();
    final client = ApiDiscoverFavoriteClient(transport: transport, accounts: accounts.stream);
    accounts.add('A');
    await Future<void>.delayed(Duration.zero);
    transport.pendingLists.last.complete(<String>{});
    await Future<void>.delayed(Duration.zero);
    final save = client.set(kind: 'product', id: 'p1', saved: true);
    final read = client.refresh();
    transport.pendingLists.last.complete(<String>{});
    await read;
    transport.pendingSets.last.complete();
    await save;
    expect(client.saved('product', 'p1'), isTrue);
    expect(client.readFailed, isFalse);

    final saveAgain = client.set(kind: 'product', id: 'p2', saved: true);
    final readAgain = client.refresh();
    transport.pendingSets.last.complete();
    await saveAgain;
    transport.pendingLists.last.complete(<String>{});
    await readAgain;
    expect(client.saved('product', 'p2'), isTrue);
    expect(client.readFailed, isFalse);
    client.dispose();
    await accounts.close();
  });

  test('logout and dispose ignore an in-flight read error', () async {
    final transport = _ScriptedTransport();
    final accounts = StreamController<String?>();
    final client = ApiDiscoverFavoriteClient(transport: transport, accounts: accounts.stream);
    accounts.add('A');
    await Future<void>.delayed(Duration.zero);
    final stale = transport.pendingLists.last;
    accounts.add(null);
    await Future<void>.delayed(Duration.zero);
    stale.completeError(const FavoriteAuthException());
    await Future<void>.delayed(Duration.zero);
    expect(client.accountKey, isNull);
    expect(client.readFailed, isFalse);
    expect(client.saved('product', 'p1'), isFalse);
    accounts.add('B');
    await Future<void>.delayed(Duration.zero);
    final during = transport.pendingLists.last;
    client.dispose();
    during.completeError(Exception('network'));
    await Future<void>.delayed(Duration.zero);
    expect(client.readFailed, isFalse);
    await accounts.close();
  });

  test('an older read does not overwrite a newer read', () async {
    final transport = _ScriptedTransport();
    final accounts = StreamController<String?>();
    final client = ApiDiscoverFavoriteClient(transport: transport, accounts: accounts.stream);
    accounts.add('A');
    await Future<void>.delayed(Duration.zero);
    transport.pendingLists.last.complete(<String>{});
    await Future<void>.delayed(Duration.zero);
    final older = client.refresh();
    final newer = client.refresh();
    transport.pendingLists.last.complete({'product:newer'});
    await newer;
    transport.pendingLists[transport.pendingLists.length - 2].complete({'product:older'});
    await older;
    expect(client.saved('product', 'newer'), isTrue);
    expect(client.saved('product', 'older'), isFalse);
    client.dispose();
    await accounts.close();
  });
}

class _SavedCall {
  _SavedCall(this.kind, this.id, this.saved);
  final String kind;
  final String id;
  final bool saved;
}

class _ScriptedTransport implements DiscoverFavoriteTransport {
  _ScriptedTransport({this.failList = false});

  bool failList;
  final pendingLists = <Completer<Set<String>>>[];
  final pendingSets = <Completer<void>>[];
  final savedCalls = <_SavedCall>[];

  @override
  Future<Set<String>> listFavoriteKeys() {
    if (failList) return Future.error(Exception('read failed'));
    final gate = Completer<Set<String>>();
    pendingLists.add(gate);
    return gate.future;
  }

  @override
  Future<void> setFavorite({required String kind, required String id, required bool saved}) {
    savedCalls.add(_SavedCall(kind, id, saved));
    final gate = Completer<void>();
    pendingSets.add(gate);
    return gate.future;
  }
}
