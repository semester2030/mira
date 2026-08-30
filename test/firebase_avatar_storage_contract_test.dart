import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/profile/data/storage/avatar_storage_contract.dart';

void main() {
  group('AvatarStorageContract', () {
    test('builds the owner-scoped canonical object path', () {
      expect(
        AvatarStorageContract.objectPath('user-123'),
        'avatars/user-123/avatar',
      );
      expect(() => AvatarStorageContract.objectPath(''), throwsArgumentError);
      expect(
        () => AvatarStorageContract.objectPath('other/user'),
        throwsArgumentError,
      );
    });

    test('accepts only the declared image content types', () {
      expect(
        AvatarStorageContract.contentTypeForPath('/tmp/photo.jpg'),
        'image/jpeg',
      );
      expect(
        AvatarStorageContract.contentTypeForPath('/tmp/photo.JPEG'),
        'image/jpeg',
      );
      expect(
        AvatarStorageContract.contentTypeForPath('/tmp/photo.png'),
        'image/png',
      );
      expect(
        AvatarStorageContract.contentTypeForPath('/tmp/photo.webp'),
        'image/webp',
      );
      expect(
        () => AvatarStorageContract.contentTypeForPath('/tmp/photo.pdf'),
        throwsArgumentError,
      );
    });

    test('client and committed rules share path, ownership and limits', () {
      final rules = File('storage.rules').readAsStringSync();
      final dataSource = File(
        'lib/features/profile/data/datasources/'
        'profile_remote_data_source.dart',
      ).readAsStringSync();

      expect(rules, contains('match /avatars/{userId}/avatar'));
      expect(rules, contains('request.auth.uid == userId'));
      expect(rules, contains('request.auth != null'));
      expect(rules, contains('request.resource.size <= 5 * 1024 * 1024'));
      expect(
        rules,
        contains(
          "request.resource.contentType.matches('image/(jpeg|png|webp)')",
        ),
      );
      expect(rules, isNot(contains('match /avatars/{legacyFile}')));
      expect(rules, isNot(contains('allow read, write: if true')));

      expect(
        dataSource,
        contains('AvatarStorageContract.objectPath(user.uid)'),
      );
      expect(
        dataSource,
        contains('SettableMetadata(contentType: contentType)'),
      );
      expect(dataSource, contains('AvatarStorageContract.maxBytes'));
    });

    test('declares the same five MiB upload boundary as rules', () {
      expect(AvatarStorageContract.maxBytes, 5 * 1024 * 1024);
    });
  });
}
