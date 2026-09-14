/**
 * YouCam / Perfect Corp face capture error taxonomy (surgical Phase 5).
 * Capture-quality tokens must never become HTTP 503 / SERVICE_UNAVAILABLE.
 */
export type FaceCaptureErrorCode =
  | 'CAPTURE_LIGHTING_TOO_DARK'
  | 'CAPTURE_LIGHTING_TOO_BRIGHT'
  | 'CAPTURE_FACE_OUT_OF_BOUNDS'
  | 'CAPTURE_NO_FACE'
  | 'CAPTURE_MULTIPLE_FACES'
  | 'CAPTURE_FACE_TOO_SMALL'
  | 'INVALID_IMAGE';

export type FaceProviderUserAction = 'recapture' | 'retry' | 'none';

export type FaceProviderClientError = {
  code: FaceCaptureErrorCode | string;
  category: 'capture_quality' | 'provider' | 'timeout' | 'internal';
  message: string;
  messageEn?: string;
  retryable: boolean;
  requiresRecapture: boolean;
  userAction: FaceProviderUserAction;
};

/** Arabic user messages for face gate rejections. */
export const FACE_GATE_MESSAGES = {
  empty: 'الصورة مطلوبة — التقطي selfie واضح.',
  invalidImage: 'ملف الصورة غير صالح — استخدمي JPEG أو PNG.',
  tooSmall:
    'دقة الصورة منخفضة — التقطي صورة أوضح بوجهك في منتصف الإطار.',
  tooLarge: 'حجم الصورة كبير جداً — جرّبي صورة أصغر.',
  extremeAspect:
    'نسبة الصورة غير مناسبة لتحليل الوجه — التقطي selfie عمودي.',
} as const;

/** YouCam / Perfect Corp tokens that mean «not a valid face» — never mock-fallback. */
export const FACE_BLOCKING_YOUCAM_TOKENS = [
  'no_face',
  'face_not_found',
  'error_src_no_face',
  'error_face_not_found',
  'error_no_face',
  'face_detection_failed',
  'invalid_face',
  'no face detected',
  'face not detected',
] as const;

/**
 * Quality issues — may retry with image variants, but never mock after exhaustion.
 * Do NOT include face_out_of_bound here (enhancement retries can worsen bounds).
 */
export const FACE_QUALITY_YOUCAM_TOKENS = [
  'error_src_face_too_small',
  'face_too_small',
  'error_lighting_dark',
  'error_lighting_bright',
  'error_lighting',
  'lighting_dark',
  'lighting_bright',
] as const;

/**
 * Immediate recapture — do not continue YouCam variant retries.
 * Evidence: production final token error_src_face_out_of_bound.
 */
export const FACE_RECAPTURE_IMMEDIATE_YOUCAM_TOKENS = [
  'error_src_face_out_of_bound',
  'face_out_of_bound',
  'out_of_bound',
  'out_of_bounds',
] as const;

export function isFaceBlockingYouCamError(message: string): boolean {
  const lower = message.toLowerCase();
  return FACE_BLOCKING_YOUCAM_TOKENS.some((token) => lower.includes(token));
}

export function isFaceQualityYouCamError(message: string): boolean {
  const lower = message.toLowerCase();
  return FACE_QUALITY_YOUCAM_TOKENS.some((token) => lower.includes(token));
}

export function isFaceRecaptureImmediateYouCamError(message: string): boolean {
  const lower = message.toLowerCase();
  return FACE_RECAPTURE_IMMEDIATE_YOUCAM_TOKENS.some((token) =>
    lower.includes(token),
  );
}

export function classifyYouCamCaptureError(
  message: string,
): FaceProviderClientError | null {
  const lower = message.toLowerCase();

  if (
    lower.includes('error_lighting_dark') ||
    lower.includes('lighting_dark')
  ) {
    return {
      code: 'CAPTURE_LIGHTING_TOO_DARK',
      category: 'capture_quality',
      message:
        'التقط الصورة في مكان أكثر إضاءة للحصول على تحليل أوضح.',
      messageEn: 'Retake in brighter light for a clearer analysis.',
      retryable: false,
      requiresRecapture: true,
      userAction: 'recapture',
    };
  }

  if (
    lower.includes('error_lighting_bright') ||
    lower.includes('lighting_bright') ||
    lower.includes('too_bright')
  ) {
    return {
      code: 'CAPTURE_LIGHTING_TOO_BRIGHT',
      category: 'capture_quality',
      message: 'الإضاءة قوية جداً — انتقلي لمكان بإضاءة أمامية أوضح.',
      messageEn: 'Lighting is too bright — move to softer front light.',
      retryable: false,
      requiresRecapture: true,
      userAction: 'recapture',
    };
  }

  if (isFaceRecaptureImmediateYouCamError(lower)) {
    return {
      code: 'CAPTURE_FACE_OUT_OF_BOUNDS',
      category: 'capture_quality',
      message:
        'تأكد من ظهور الوجه كاملًا داخل الإطار ثم أعد التقاط الصورة.',
      messageEn: 'Keep your full face inside the frame, then retake.',
      retryable: false,
      requiresRecapture: true,
      userAction: 'recapture',
    };
  }

  if (isFaceBlockingYouCamError(lower)) {
    return {
      code: 'CAPTURE_NO_FACE',
      category: 'capture_quality',
      message:
        'لم نتعرف على وجه — التقطي selfie واضح وثبّتي وجهك في منتصف الإطار.',
      messageEn: 'No face detected — take a clear centered selfie.',
      retryable: false,
      requiresRecapture: true,
      userAction: 'recapture',
    };
  }

  if (
    lower.includes('multiple_faces') ||
    lower.includes('more than one face')
  ) {
    return {
      code: 'CAPTURE_MULTIPLE_FACES',
      category: 'capture_quality',
      message: 'وجدنا أكثر من وجه — التقطي صورة لوجه واحد فقط.',
      messageEn: 'Multiple faces detected — capture one face only.',
      retryable: false,
      requiresRecapture: true,
      userAction: 'recapture',
    };
  }

  if (
    lower.includes('error_src_face_too_small') ||
    lower.includes('face_too_small')
  ) {
    return {
      code: 'CAPTURE_FACE_TOO_SMALL',
      category: 'capture_quality',
      message:
        'تعذر تحليل الصورة — أعيدي التقاط صورة أقرب مع إضاءة أمامية.',
      messageEn: 'Face too small — move closer with front lighting.',
      retryable: false,
      requiresRecapture: true,
      userAction: 'recapture',
    };
  }

  if (isFaceQualityYouCamError(lower)) {
    return {
      code: 'INVALID_IMAGE',
      category: 'capture_quality',
      message:
        'تعذر تحليل الصورة — تأكدي من وضوح الوجه وقرب الكاميرا.',
      messageEn: 'Image quality insufficient — retake a clearer selfie.',
      retryable: false,
      requiresRecapture: true,
      userAction: 'recapture',
    };
  }

  return null;
}

/** @deprecated Prefer classifyYouCamCaptureError(...).message */
export function faceGateMessageFromYouCam(message: string): string {
  return (
    classifyYouCamCaptureError(message)?.message ??
    'تعذر تحليل الصورة — تأكدي من وضوح الوجه وقرب الكاميرا.'
  );
}
