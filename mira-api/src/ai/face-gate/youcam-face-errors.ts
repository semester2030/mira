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

/** Quality issues — may retry with image variants, but never mock after exhaustion. */
export const FACE_QUALITY_YOUCAM_TOKENS = [
  'error_src_face_too_small',
  'face_too_small',
  'error_lighting_dark',
  'error_lighting',
] as const;

export function isFaceBlockingYouCamError(message: string): boolean {
  const lower = message.toLowerCase();
  return FACE_BLOCKING_YOUCAM_TOKENS.some((token) => lower.includes(token));
}

export function isFaceQualityYouCamError(message: string): boolean {
  const lower = message.toLowerCase();
  return FACE_QUALITY_YOUCAM_TOKENS.some((token) => lower.includes(token));
}

export function faceGateMessageFromYouCam(message: string): string {
  const lower = message.toLowerCase();
  if (isFaceBlockingYouCamError(lower)) {
    return 'لم نتعرف على وجه — التقطي selfie واضح وثبّتي وجهك في منتصف الإطار.';
  }
  if (lower.includes('error_src_face_too_small') || lower.includes('face_too_small')) {
    return 'تعذر تحليل الصورة — أعيدي التقاط صورة أقرب مع إضاءة أمامية.';
  }
  if (lower.includes('error_lighting_dark') || lower.includes('lighting_dark')) {
    return 'الإضاءة ضعيفة — انتقلي لمكان أفضل ثم أعيدي المحاولة.';
  }
  return 'تعذر تحليل الصورة — تأكدي من وضوح الوجه وقرب الكاميرا.';
}
