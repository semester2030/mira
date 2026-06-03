import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { SubmitWebsiteLeadDto } from './dto/submit-website-lead.dto';

export type WebsiteFeature = {
  id: string;
  icon: string;
  titleAr: string;
  summaryAr: string;
  bulletsAr: string[];
  status: 'live' | 'beta' | 'soon';
};

const FEATURES: WebsiteFeature[] = [
  {
    id: 'skin',
    icon: '✨',
    titleAr: 'تحليل البشرة الذكي',
    summaryAr: 'Selfie واحدة → تقرير شامل مدعوم من Perfect Corp YouCam عبر خوادم ميرا الآمنة.',
    bulletsAr: [
      'رادار صحة البشرة ومصفوفة المؤشرات',
      'عمر البشرة ومؤشرات الترطيب والمسام',
      'روتين يومي مخصص + منتجات مناسبة',
      'الصورة لا تُخزَّن بعد التحليل',
    ],
    status: 'live',
  },
  {
    id: 'outfit',
    icon: '👗',
    titleAr: 'تحليل الإطلالة',
    summaryAr: 'قيّمي تناغم الألوان وملاءمة اللوك للمناسبة (عمل، سهرة، يومي…).',
    bulletsAr: [
      'اختيار المناسبة قبل التحليل',
      'درجة جمال وتوصيات تحسين',
      'سجل إطلالات سابق',
    ],
    status: 'live',
  },
  {
    id: 'discover',
    icon: '🛍️',
    titleAr: 'اكتشفي — Marketplace',
    summaryAr: 'ماركات، عيادات، وصالونات مطابقة لتقرير بشرتك.',
    bulletsAr: [
      'منتجات موصى بها بعد التحليل',
      'خدمات عيادات وصالونات (حجز قريباً)',
      'Deep link لمتاجر الشركاء',
    ],
    status: 'live',
  },
  {
    id: 'auth',
    icon: '📱',
    titleAr: 'دخول برقم الجوال',
    summaryAr: 'OTP سعودي — تسجيل ودخول من شاشة واحدة بدون كلمة مرور.',
    bulletsAr: ['تحقق SMS', 'وضع زائر للتصفح', 'حذف الحساب من الإعدادات'],
    status: 'live',
  },
  {
    id: 'points',
    icon: '🏆',
    titleAr: 'نقاط ومستويات',
    summaryAr: 'تابعي تقدمكِ واحصلي على نقاط مع كل تحليل.',
    bulletsAr: ['مستويات مستخدم', 'لوحة نقاط', 'نصائح يومية'],
    status: 'live',
  },
  {
    id: 'privacy',
    icon: '🔒',
    titleAr: 'خصوصية by design',
    summaryAr: 'معالجة على السيرفر، ملخص نصي فقط في حسابك.',
    bulletsAr: [
      'TLS مشفر',
      'موافقة خصوصية قبل التحليل',
      'لا بيع للبيانات',
    ],
    status: 'live',
  },
  {
    id: 'subscription',
    icon: '💎',
    titleAr: 'اشتراك Premium',
    summaryAr: 'حدود تحليل شهرية ووصول موسّع (قابل للتفعيل).',
    bulletsAr: ['خطط Free / Premium', 'RevenueCat', 'Paywall في التطبيق'],
    status: 'beta',
  },
  {
    id: 'partners-portal',
    icon: '🤝',
    titleAr: 'بوابة الشركاء',
    summaryAr: 'لوحة B2B للماركات والعيادات والصالونات.',
    bulletsAr: ['partners.mira.app (قريباً)', 'Admin اعتماد الشركاء', 'عمولات وتقارير'],
    status: 'soon',
  },
];

@Injectable()
export class WebsiteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketplace: MarketplaceService,
  ) {}

  getFeatures() {
    return {
      version: '1.0',
      updatedAt: new Date().toISOString(),
      features: FEATURES,
    };
  }

  async getStats() {
    const [partners, products, services, leads] = await Promise.all([
      this.prisma.partner.count({ where: { status: 'active' } }),
      this.prisma.product.count({ where: { active: true } }),
      this.prisma.service.count({ where: { active: true } }),
      this.prisma.websiteLead.count(),
    ]);

    return {
      partners,
      products,
      services,
      contactSubmissions: leads,
      skinEngine: 'Perfect Corp YouCam',
      apiStatus: 'ok',
    };
  }

  async getPartnersPreview(type?: string, limit = 8) {
    const list = await this.marketplace.listPartners(type, undefined);
    return list.slice(0, Math.min(limit, 20));
  }

  async submitLead(dto: SubmitWebsiteLeadDto, ipHash?: string) {
    const lead = await this.prisma.websiteLead.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim(),
        type: dto.type ?? 'contact',
        message: dto.message.trim(),
        ipHash,
      },
    });

    return {
      id: lead.id,
      message: 'شكراً — استلمنا رسالتك وسنتواصل معك قريباً.',
    };
  }
}
