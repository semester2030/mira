class ProfileEntity {
  final String id;
  final String name;
  final String email;
  final String? phone;
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
    required this.email,
    this.phone,
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
    String? email,
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
      email: email ?? this.email,
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
      'email': email,
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
    return ProfileEntity(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      level: json['level'] as String,
      points: json['points'] as int,
      analyses: json['analyses'] as int,
      tips: json['tips'] as int,
      lastActive: json['lastActive'] as String,
      achievements: (json['achievements'] as List<dynamic>?)
              ?.map((a) => AchievementEntity.fromJson(a as Map<String, dynamic>))
              .toList() ??
          const [],
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: json['updatedAt'] != null 
          ? DateTime.parse(json['updatedAt'] as String) 
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
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      icon: json['icon'] as String,
      achievedAt: DateTime.parse(json['achievedAt'] as String),
      points: json['points'] as int,
    );
  }
}
