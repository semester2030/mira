export const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const VIDEO_MIME = new Set(['video/mp4']);
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 20 * 1024 * 1024;

export const FIELD_OWNERSHIP = [
  { field: 'priceHalalas', ownerAr: 'تشغيلي (شريك/مصدر)', reviewAr: 'يُحدَّث على الصف المنشور دون مراجعة محتوى' },
  { field: 'stockQty', ownerAr: 'تشغيلي (شريك)', reviewAr: 'مخزون يومي على الصف المنشور دون مراجعة محتوى' },
  { field: 'deliveryFeeHalalas', ownerAr: 'تشغيلي (شريك)', reviewAr: 'رسوم التوصيل على الصف المنشور؛ الفراغ ليس مجانيًا' },
  { field: 'purchaseMode', ownerAr: 'تشغيلي (شريك)', reviewAr: 'external | internal_cod على الصف المنشور' },
  { field: 'availabilityJson', ownerAr: 'تشغيلي (شريك)', reviewAr: 'توفر المواعيد على الصف المنشور بعد تحقق عدم التداخل' },
  { field: 'bookingEnabled', ownerAr: 'تشغيلي (شريك)', reviewAr: 'تفعيل طلب الموعد على الصف المنشور' },
  { field: 'optionsJson', ownerAr: 'تحرير الشريك', reviewAr: 'مسودة draftOptionsJson حتى اعتماد الإدارة؛ لا تُكتب مباشرة على المنشور' },
  { field: 'variantsJson', ownerAr: 'تحرير الشريك', reviewAr: 'مسودة draftVariantsJson حتى اعتماد الإدارة' },
  { field: 'nameAr', ownerAr: 'تحرير الشريك', reviewAr: 'مسودة حتى اعتماد الإدارة، والنسخة المنشورة تبقى ظاهرة' },
  { field: 'descriptionAr', ownerAr: 'تحرير الشريك', reviewAr: 'مسودة حتى اعتماد الإدارة' },
  { field: 'media', ownerAr: 'تحرير الشريك', reviewAr: 'لا يظهر في الخلاصة قبل النشر، والحذف المؤكد يتم بعد الاعتماد' },
  { field: 'miraNoteAr', ownerAr: 'ميرا', reviewAr: 'المزامنة لا تمسحه' },
  { field: 'category', ownerAr: 'ميرا', reviewAr: 'لا يُخمن من الاسم ولا يُستبدل بالاستيراد' },
  { field: 'contentStatus', ownerAr: 'الإدارة', reviewAr: 'الشريك لا يمنح نفسه الاعتماد' },
] as const;

export function sniffMedia(mime: string, bytes: Buffer): boolean {
  if (mime === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/webp') {
    return bytes.length > 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (mime === 'video/mp4') return mp4Playable(bytes);
  return false;
}

/** A header-only ftyp buffer is not a playable file. */
export function mp4Playable(bytes: Buffer): boolean {
  if (bytes.length < 32) return false;
  if (bytes.subarray(4, 8).toString('ascii') !== 'ftyp') return false;
  return bytes.includes(Buffer.from('moov'));
}

/** Media uploads may carry base64. Other requests stay on a small JSON limit. */
export function catalogRequestLimit(method: string, path: string): number {
  const mediaUpload = method === 'POST' && /\/partners-portal\/(?:products|services)\/[^/]+\/media$/.test(path);
  if (!mediaUpload) return 100 * 1024;
  const base64Budget = Math.ceil(VIDEO_MAX_BYTES / 3) * 4;
  return base64Budget + 64 * 1024;
}
