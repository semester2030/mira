/**
 * Operational tracking helpers for COD orders and pay-at-venue bookings.
 * SLA hours are env-tunable; defaults are for isolated tests only — confirm before production.
 */

export type OpsResponsible = 'customer' | 'partner' | 'admin' | 'none';

export type OpsHint = {
  nextActionAr: string;
  responsibleRole: OpsResponsible;
  responsibleLabelAr: string;
};

export type AttentionItem = {
  kind: 'order' | 'booking';
  id: string;
  publicNumber: string;
  partnerId: string;
  partnerNameAr: string;
  reasonCode: string;
  reasonAr: string;
  responsibleRole: OpsResponsible;
  responsibleLabelAr: string;
  since: string;
  status: string;
  paymentCollectionStatus?: string;
};

function hoursEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  // Allow 0 in isolated proofs (immediate overdue). Production should set positive hours.
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Defaults for isolated ops proofs. Production must set explicit policy. */
export function opsSlaMs() {
  return {
    orderAcceptMs: hoursEnv('MIRA_OPS_ORDER_ACCEPT_HOURS', 24) * 3600_000,
    bookingReplyMs: hoursEnv('MIRA_OPS_BOOKING_REPLY_HOURS', 24) * 3600_000,
    collectMs: hoursEnv('MIRA_OPS_COLLECT_HOURS', 48) * 3600_000,
  };
}

export function opsSlaHours() {
  return {
    orderAcceptHours: hoursEnv('MIRA_OPS_ORDER_ACCEPT_HOURS', 24),
    bookingReplyHours: hoursEnv('MIRA_OPS_BOOKING_REPLY_HOURS', 24),
    collectHours: hoursEnv('MIRA_OPS_COLLECT_HOURS', 48),
  };
}

export function actorDisplayAr(actorType: string | null | undefined, actorId: string | null | undefined): string {
  const type = actorType || 'system';
  if (type === 'customer') return 'العميلة';
  if (type === 'partner') return actorId ? `الشريك (${actorId})` : 'الشريك';
  if (type === 'admin') {
    if (!actorId || actorId === 'admin-key') return 'مفتاح الإدارة المشترك (بلا موظف مسمّى)';
    return `موظف إدارة (${actorId})`;
  }
  if (type === 'system') return 'النظام';
  return type;
}

export function orderOpsHint(
  fulfillmentStatus: string,
  paymentCollectionStatus: string,
  view: 'customer' | 'partner' | 'admin' | 'system',
): OpsHint {
  // system uses partner/admin-facing copy (not customer)
  const audience = view === 'customer' ? 'customer' : 'staff';
  if (fulfillmentStatus === 'new') {
    return {
      nextActionAr: audience === 'customer' ? 'بانتظار قبول المتجر' : 'اقبلِ الطلب أو ارفضه',
      responsibleRole: 'partner',
      responsibleLabelAr: 'البائع',
    };
  }
  if (fulfillmentStatus === 'accepted') {
    return {
      nextActionAr: audience === 'customer' ? 'المتجر قبل الطلب ويجهّزه' : 'ابدئي التجهيز',
      responsibleRole: 'partner',
      responsibleLabelAr: 'البائع',
    };
  }
  if (fulfillmentStatus === 'preparing') {
    return {
      nextActionAr: audience === 'customer' ? 'الطلب قيد التجهيز' : 'سجّلي الخروج للتوصيل عند الجاهزية',
      responsibleRole: 'partner',
      responsibleLabelAr: 'البائع',
    };
  }
  if (fulfillmentStatus === 'out_for_delivery') {
    return {
      nextActionAr: audience === 'customer' ? 'الطلب في الطريق إليكِ' : 'أكّدي التسليم أو تعذّره',
      responsibleRole: 'partner',
      responsibleLabelAr: 'البائع',
    };
  }
  if (fulfillmentStatus === 'delivered' && paymentCollectionStatus === 'uncollected') {
    return {
      nextActionAr:
        view === 'customer'
          ? 'تم التسليم — التحصيل النقدي لم يُسجَّل بعد'
          : 'سجّلي استلام النقد (منفصل عن التسليم)',
      responsibleRole: 'partner',
      responsibleLabelAr: 'البائع',
    };
  }
  if (fulfillmentStatus === 'delivered' && paymentCollectionStatus === 'collected') {
    return { nextActionAr: 'مكتمل — سُلّم وحُصِّل', responsibleRole: 'none', responsibleLabelAr: 'لا إجراء' };
  }
  if (fulfillmentStatus === 'delivered' && paymentCollectionStatus === 'waived') {
    return { nextActionAr: 'مكتمل — سُلّم وأُعفي التحصيل', responsibleRole: 'none', responsibleLabelAr: 'لا إجراء' };
  }
  if (fulfillmentStatus === 'cancelled' || fulfillmentStatus === 'rejected') {
    return { nextActionAr: 'لا إجراء — الطلب مغلق', responsibleRole: 'none', responsibleLabelAr: 'لا إجراء' };
  }
  if (fulfillmentStatus === 'failed_delivery') {
    return {
      nextActionAr: view === 'customer' ? 'تعذر التسليم — المتجر يعيد المحاولة أو يلغي' : 'أعيدي التوصيل أو ألغي',
      responsibleRole: 'partner',
      responsibleLabelAr: 'البائع',
    };
  }
  return { nextActionAr: fulfillmentStatus, responsibleRole: 'partner', responsibleLabelAr: 'البائع' };
}

export function bookingOpsHint(status: string, view: 'customer' | 'partner' | 'admin'): OpsHint {
  if (status === 'requested') {
    return {
      nextActionAr: view === 'customer' ? 'بانتظار موافقة مقدّم الخدمة' : 'أكّدي الموعد أو ارفضيه',
      responsibleRole: 'partner',
      responsibleLabelAr: 'مقدّم الخدمة',
    };
  }
  if (status === 'confirmed') {
    return {
      nextActionAr:
        view === 'customer' ? 'موعد مؤكد — الدفع عند تقديم الخدمة' : 'بعد حلول الموعد: أتمّي الخدمة',
      responsibleRole: view === 'customer' ? 'customer' : 'partner',
      responsibleLabelAr: view === 'customer' ? 'العميلة (حضور الموعد)' : 'مقدّم الخدمة',
    };
  }
  if (status === 'completed') {
    return { nextActionAr: 'اكتملت الخدمة', responsibleRole: 'none', responsibleLabelAr: 'لا إجراء' };
  }
  if (status === 'cancelled' || status === 'rejected') {
    return { nextActionAr: 'لا إجراء — الحجز مغلق', responsibleRole: 'none', responsibleLabelAr: 'لا إجراء' };
  }
  return { nextActionAr: status, responsibleRole: 'partner', responsibleLabelAr: 'مقدّم الخدمة' };
}

export function isPublicOrderRef(ref: string): boolean {
  return /^MO-[A-Z0-9-]+$/i.test(ref.trim());
}

export function isPublicBookingRef(ref: string): boolean {
  return /^MB-[A-Z0-9-]+$/i.test(ref.trim());
}
