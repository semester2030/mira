/// Internal reason codes — versioned, not shown raw to users.
abstract final class CaptureReasonCodes {
  CaptureReasonCodes._();

  static const cameraUnavailable = 'capture_camera_unavailable';
  static const cameraInitializing = 'capture_camera_initializing';
  static const cameraPaused = 'capture_camera_paused';
  static const permissionDenied = 'capture_permission_denied';
  static const noFace = 'capture_no_face';
  static const multipleFaces = 'capture_multiple_faces';
  static const faceUnknown = 'capture_face_unknown';
  static const centerFace = 'capture_center_face';
  static const moveCloser = 'capture_move_closer';
  static const moveFarther = 'capture_move_farther';
  static const adjustPose = 'capture_adjust_pose';
  static const turnLeft = 'capture_turn_left'; // SUBJECT_LEFT cue: turn toward subject-left
  static const turnRight = 'capture_turn_right';
  static const lookUp = 'capture_look_up';
  static const lookDown = 'capture_look_down';
  static const straighten = 'capture_straighten';
  static const lowLight = 'capture_low_light';
  static const overexposed = 'capture_overexposed';
  static const blurry = 'capture_blurry';
  static const holdStill = 'capture_hold_still';
  static const staleFrame = 'capture_stale_frame';
  static const qualityBlocked = 'capture_quality_blocked';
  static const ready = 'capture_ready';
  static const autoEligible = 'capture_auto_eligible';
  static const captureInProgress = 'capture_in_progress';
  static const captured = 'capture_captured';
}
