import '../../../../core/utils/firestore_parsers.dart';

class ProfileEntity {
  final String id;
  final String name;
  final String phone;
  final String? avatarUrl;
  final String level;
  final int points;
  final int analyses;
  final int tips;
  final String lastActive;
  final List<AchievementEntity> achievements;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const ProfileEntity({
    required this.id,
    required this.name,
    required this.phone,
    this.avatarUrl,
    required this.level,
    required this.points,
    required this.analyses,
    required this.tips,
    required this.lastActive,
    required this.achievements,
    required this.createdAt,
    this.updatedAt,
  });

  ProfileEntity copyWith({
    String? id,
    String? name,
    String? phone,
    String? avatarUrl,
    String? level,
    int? points,
    int? analyses,
    int? tips,
    String? lastActive,
    List<AchievementEntity>? achievements,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return ProfileEntity(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      level: level ?? this.level,
      points: points ?? this.points,
      analyses: analyses ?? this.analyses,
      tips: tips ?? this.tips,
      lastActive: lastActive ?? this.lastActive,
      achievements: achievements ?? this.achievements,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'avatarUrl': avatarUrl,
      'level': level,
      'points': points,
      'analyses': analyses,
      'tips': tips,
      'lastActive': lastActive,
      'achievements': achievements.map((a) => a.toJson()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  factory ProfileEntity.fromJson(Map<String, dynamic> json) {
    final phoneRaw = json['phone'] != null
        ? FirestoreParsers.string(json['phone'])
        : FirestoreParsers.string(json['email'], fallback: '');
    return ProfileEntity(
      id: FirestoreParsers.string(json['id']),
      name: FirestoreParsers.string(json['name'], fallback: 'ميرا'),
      phone: phoneRaw,
      avatarUrl: json['avatarUrl'] != null ? FirestoreParsers.string(json['avatarUrl']) : null,
      level: FirestoreParsers.string(json['level'], fallback: 'مبتدئة'),
      points: FirestoreParsers.integer(json['points']),
      analyses: FirestoreParsers.integer(json['analyses']),
      tips: FirestoreParsers.integer(json['tips']),
      lastActive: FirestoreParsers.lastActiveLabel(json['lastActive']),
      achievements: (json['achievements'] as List<dynamic>?)
              ?.map((a) => AchievementEntity.fromJson(a as Map<String, dynamic>))
              .toList() ??
          const [],
      createdAt: FirestoreParsers.dateTime(json['createdAt']),
      updatedAt: json['updatedAt'] != null
          ? FirestoreParsers.dateTime(json['updatedAt'])
          : null,
    );
  }
}

class AchievementEntity {
  final String id;
  final String title;
  final String description;
  final String icon;
  final DateTime achievedAt;
  final int points;

  const AchievementEntity({
    required this.id,
    required this.title,
    required this.description,
    required this.icon,
    required this.achievedAt,
    required this.points,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'icon': icon,
      'achievedAt': achievedAt.toIso8601String(),
      'points': points,
    };
  }

  factory AchievementEntity.fromJson(Map<String, dynamic> json) {
    return AchievementEntity(
      id: FirestoreParsers.string(json['id']),
      title: FirestoreParsers.string(json['title']),
      description: FirestoreParsers.string(json['description']),
      icon: FirestoreParsers.string(json['icon'], fallback: 'star'),
      achievedAt: FirestoreParsers.dateTime(json['achievedAt']),
      points: FirestoreParsers.integer(json['points']),
    );
  }
}
