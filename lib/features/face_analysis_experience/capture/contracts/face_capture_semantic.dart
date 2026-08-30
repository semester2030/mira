/// Semantic enums for capture readiness (public-safe labels mapped separately).
enum FaceCaptureReadinessState {
  initializing,
  searchingFace,
  multipleFaces,
  alignFace,
  moveCloser,
  moveFarther,
  adjustAngle,
  improveLight,
  holdStill,
  ready,
  captureInProgress,
  captured,
  qualityBlocked,
  cameraUnavailable,
  permissionDenied,
}

enum FacePresenceKind { noFace, singleFace, multipleFaces, unknown }

enum AlignmentKind { good, adjust, unknown }

enum DistanceKind { tooFar, good, tooClose, unknown }

enum PoseKind {
  good,
  turnLeft,
  turnRight,
  lookUp,
  lookDown,
  straighten,
  unknown,
}

enum LightingKind { tooDark, good, tooBright, unknown }

enum BlurKind { sharpEnough, blurry, unknown }

enum StabilityKind { stable, moving, unknown }

enum GateRequirement { mandatory, optional, informational }

enum CaptureLatchPhase { idle, eligible, firing, captured }
