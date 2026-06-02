import { PrismaClient } from '@prisma/client';

/** Demo partners for v1 — replace via partner portal later. */
export async function seedMarketplaceIfEmpty(prisma: PrismaClient): Promise<void> {
  const count = await prisma.partner.count();
  if (count > 0) return;

  const brands = [
    {
      type: 'brand',
      nameAr: 'لوريال باريس',
      nameEn: 'Loreal Paris',
      descriptionAr: 'عناية بشرة وشعر عالمية',
      logoEmoji: '💄',
      storeUrl: 'https://www.loreal-paris.com',
      products: [
        {
          nameAr: 'سيروم فيتامين C',
          nameEn: 'Vitamin C Serum',
          descriptionAr: 'توحيد لون وإشراق',
          priceHalalas: 8900,
          externalUrl: 'https://www.amazon.sa',
          concernTags: ['age_spot', 'texture', 'radiance'],
          skinTypes: ['all'],
          stepAr: 'صباحًا',
        },
        {
          nameAr: 'مرطب حمض الهيالورونيك',
          nameEn: 'Hyaluronic Moisturizer',
          priceHalalas: 7500,
          externalUrl: 'https://www.noon.com',
          concernTags: ['moisture', 'texture'],
          skinTypes: ['dry', 'combination', 'normal'],
          stepAr: 'صباحًا ومساءً',
        },
      ],
    },
    {
      type: 'brand',
      nameAr: 'ذا بودي شوب',
      nameEn: 'The Body Shop',
      descriptionAr: 'ترطيب طبيعي',
      logoEmoji: '🌿',
      storeUrl: 'https://www.thebodyshop.com',
      products: [
        {
          nameAr: 'تونر شاي الأخضر',
          nameEn: 'Green Tea Toner',
          priceHalalas: 6500,
          externalUrl: 'https://www.namshi.com',
          concernTags: ['oiliness', 'pore', 'redness'],
          skinTypes: ['oily', 'combination'],
          stepAr: 'بعد التنظيف',
        },
        {
          nameAr: 'مقشر BHA لطيف',
          nameEn: 'Gentle BHA Exfoliant',
          priceHalalas: 9200,
          externalUrl: 'https://www.noon.com',
          concernTags: ['pore', 'acne', 'texture'],
          skinTypes: ['oily', 'combination'],
          stepAr: '1–2 مرات أسبوعيًا',
        },
      ],
    },
    {
      type: 'brand',
      nameAr: 'نيتروجينا',
      nameEn: 'Neutrogena',
      logoEmoji: '✨',
      storeUrl: 'https://www.neutrogena.com',
      products: [
        {
          nameAr: 'واقي شمس خفيف SPF50',
          nameEn: 'SPF50 Light Sunscreen',
          priceHalalas: 5500,
          externalUrl: 'https://www.amazon.sa',
          concernTags: ['age_spot', 'wrinkle', 'texture'],
          skinTypes: ['all'],
          stepAr: 'كل صباح',
        },
        {
          nameAr: 'غسول Hydro Boost',
          nameEn: 'Hydro Boost Cleanser',
          priceHalalas: 4800,
          externalUrl: 'https://www.noon.com',
          concernTags: ['moisture', 'oiliness'],
          skinTypes: ['combination', 'oily', 'normal'],
          stepAr: 'صباحًا ومساءً',
        },
      ],
    },
  ];

  const clinics = [
    {
      type: 'clinic',
      nameAr: 'عيادة نور الجلد',
      nameEn: 'Noor Skin Clinic',
      descriptionAr: 'جلدية وتجميل طبي',
      logoEmoji: '🏥',
      city: 'الرياض',
      services: [
        {
          nameAr: 'استشارة جلدية',
          nameEn: 'Dermatology Consult',
          durationMin: 30,
          priceHalalas: 25000,
          concernTags: ['acne', 'redness', 'age_spot'],
          bookingEnabled: false,
        },
        {
          nameAr: 'تقشير كيميائي خفيف',
          nameEn: 'Light Chemical Peel',
          durationMin: 45,
          priceHalalas: 45000,
          concernTags: ['texture', 'age_spot', 'pore'],
          bookingEnabled: false,
        },
      ],
    },
    {
      type: 'clinic',
      nameAr: 'مركز لاميرا الطبي',
      nameEn: 'Lamira Medical',
      logoEmoji: '💉',
      city: 'جدة',
      services: [
        {
          nameAr: 'فحص بشرة بالذكاء الاصطناعي',
          nameEn: 'AI Skin Check',
          durationMin: 20,
          priceHalalas: 15000,
          concernTags: ['moisture', 'wrinkle', 'pore'],
          bookingEnabled: false,
        },
      ],
    },
  ];

  const salons = [
    {
      type: 'salon',
      nameAr: 'صالون روز بيوتي',
      nameEn: 'Rose Beauty Salon',
      descriptionAr: 'عناية بالبشرة والشعر',
      logoEmoji: '💅',
      city: 'الرياض',
      services: [
        {
          nameAr: 'جلسة فيشل ترطيب',
          nameEn: 'Hydrating Facial',
          durationMin: 60,
          priceHalalas: 35000,
          concernTags: ['moisture', 'texture', 'radiance'],
          bookingEnabled: false,
        },
        {
          nameAr: 'تنظيف عميق للمسام',
          nameEn: 'Deep Pore Cleansing',
          durationMin: 75,
          priceHalalas: 42000,
          concernTags: ['pore', 'oiliness', 'acne'],
          bookingEnabled: false,
        },
      ],
    },
    {
      type: 'salon',
      nameAr: 'ستوديو جلام',
      nameEn: 'Glam Studio',
      logoEmoji: '✂️',
      city: 'الرياض',
      services: [
        {
          nameAr: 'مكياج مناسبة + عناية',
          nameEn: 'Occasion Makeup + Care',
          durationMin: 90,
          priceHalalas: 55000,
          concernTags: ['radiance', 'texture'],
          bookingEnabled: false,
        },
      ],
    },
  ];

  for (const b of brands) {
    const partner = await prisma.partner.create({
      data: {
        type: b.type,
        status: 'active',
        nameAr: b.nameAr,
        nameEn: b.nameEn,
        descriptionAr: b.descriptionAr,
        logoEmoji: b.logoEmoji,
        storeUrl: b.storeUrl,
        city: 'الرياض',
        products: { create: b.products },
      },
    });
    void partner;
  }

  for (const c of clinics) {
    await prisma.partner.create({
      data: {
        type: c.type,
        status: 'active',
        nameAr: c.nameAr,
        nameEn: c.nameEn,
        descriptionAr: c.descriptionAr,
        logoEmoji: c.logoEmoji,
        city: c.city,
        services: { create: c.services },
      },
    });
  }

  for (const s of salons) {
    await prisma.partner.create({
      data: {
        type: s.type,
        status: 'active',
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        descriptionAr: s.descriptionAr,
        logoEmoji: s.logoEmoji,
        city: s.city,
        services: { create: s.services },
      },
    });
  }
}
