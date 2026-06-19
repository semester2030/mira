import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/outfit_intelligence_config.dart';
import '../../domain/services/google_vision_outfit_service.dart';

final googleVisionOutfitServiceProvider = Provider<GoogleVisionOutfitService>(
  (ref) => GoogleVisionOutfitService(),
);

final googleVisionEnabledProvider = Provider<bool>(
  (ref) => OutfitIntelligenceConfig.hasGoogleVision,
);
