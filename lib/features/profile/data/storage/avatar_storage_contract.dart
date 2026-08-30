class AvatarStorageContract {
  const AvatarStorageContract._();

  static const int maxBytes = 5 * 1024 * 1024;
  static const String objectName = 'avatar';

  static String objectPath(String uid) {
    final normalized = uid.trim();
    if (normalized.isEmpty || normalized.contains('/')) {
      throw ArgumentError.value(uid, 'uid', 'Invalid avatar owner');
    }
    return 'avatars/$normalized/$objectName';
  }

  static String contentTypeForPath(String imagePath) {
    final normalized = imagePath.toLowerCase();
    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    if (normalized.endsWith('.png')) {
      return 'image/png';
    }
    if (normalized.endsWith('.webp')) {
      return 'image/webp';
    }
    throw ArgumentError.value(
      imagePath,
      'imagePath',
      'Avatar must be JPEG, PNG, or WebP',
    );
  }
}
