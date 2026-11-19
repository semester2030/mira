/**
 * Shared booking eligibility — used by createBooking and createConsecutiveVisit.
 * Keep both paths identical for activity grants + place/branch acceptance.
 */
import { Prisma } from '@prisma/client';
import { resolveSaudiCity } from '../geo/saudi-cities';
import { coverageIncludesCity } from './catalog-filters';
import { badRequest, unprocessable } from './commerce.types';

type Tx = Prisma.TransactionClient;

export type ServiceForBooking = {
  id: string;
  partnerId: string;
  nameAr: string;
  category: string | null;
  attributesJson: Prisma.JsonValue | null;
  placeMode: string | null;
  branchId: string | null;
  coverageJson: Prisma.JsonValue | null;
  bookingEnabled: boolean;
  payMode: string;
  priceHalalas: number;
  durationMin: number;
  partner: { id: string; nameAr: string; city: string; status: string };
};

export type BranchPlaceResult = {
  placeMode: 'branch';
  branchId: string;
  visitCityId: null;
  visitAddress: null;
  travelFeeHalalas: null;
  branchLabel: string;
};

export type HomePlaceResult = {
  placeMode: 'home';
  branchId: null;
  visitCityId: string;
  visitAddress: string;
  travelFeeHalalas: number | null;
  branchLabel: string;
};

export type LegacyPlaceResult = {
  placeMode: null;
  branchId: null;
  visitCityId: null;
  visitAddress: null;
  travelFeeHalalas: null;
  branchLabel: string;
};

export type PlaceResult = BranchPlaceResult | HomePlaceResult | LegacyPlaceResult;

export function assertServiceBookableBasics(service: {
  nameAr: string;
  bookingEnabled: boolean;
  payMode: string;
  priceHalalas: number;
  durationMin: number;
}): void {
  if (!service.bookingEnabled) {
    throw unprocessable('BOOKING_NOT_ENABLED', `الحجز غير متاح لـ«${service.nameAr}»`);
  }
  if (service.payMode !== 'pay_at_venue') {
    throw unprocessable('PAY_MODE_UNSUPPORTED', 'طريقة الدفع غير مدعومة لهذه الخدمة');
  }
  if (!Number.isSafeInteger(service.priceHalalas) || service.priceHalalas <= 0 || service.durationMin <= 0) {
    throw unprocessable('SERVICE_NOT_BOOKABLE', 'بيانات الخدمة غير مكتملة للحجز');
  }
}

/** When the partner has PaGrant rows, booking requires a matching approved activity. */
export async function assertPartnerActivityApproved(tx: Tx, service: ServiceForBooking): Promise<void> {
  const grantCount = await tx.paGrant.count({ where: { partnerId: service.partnerId } });
  if (grantCount <= 0) return;

  const attrs =
    service.attributesJson && typeof service.attributesJson === 'object' && !Array.isArray(service.attributesJson)
      ? (service.attributesJson as { subcategory?: unknown; taxonomyLeaf?: unknown })
      : {};
  const leafFromAttrs =
    (typeof attrs.taxonomyLeaf === 'string' && attrs.taxonomyLeaf.trim()) ||
    (typeof attrs.subcategory === 'string' && attrs.subcategory.trim()) ||
    '';
  const categoryId =
    typeof service.category === 'string' && service.category.trim() ? service.category.trim() : '';
  const candidates = [...new Set([leafFromAttrs, categoryId].filter(Boolean))];
  if (!candidates.length) {
    throw unprocessable('ACTIVITY_NOT_APPROVED', 'هذه الخدمة خارج الأنشطة المعتمدة للجهة');
  }
  const titleNorm = service.nameAr.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  for (const activityId of candidates) {
    const categoryGrant = await tx.paGrant.findFirst({
      where: { partnerId: service.partnerId, activity: activityId, scope: 'category' },
    });
    if (categoryGrant) return;
    const oneGrant = await tx.paGrant.findFirst({
      where: {
        partnerId: service.partnerId,
        activity: activityId,
        scope: 'one',
        itemName: titleNorm,
      },
    });
    if (oneGrant) return;
  }
  throw unprocessable('ACTIVITY_NOT_APPROVED', 'هذه الخدمة خارج الأنشطة المعتمدة للجهة', {
    activity: candidates[0],
  });
}

export function servicePlaceModeOf(service: { placeMode: string | null }): string | null {
  return typeof service.placeMode === 'string' && service.placeMode.trim()
    ? service.placeMode.trim()
    : null;
}

/**
 * Resolve customer place intent against the service's published placeMode.
 * Consecutive visits always request branch — home-only services are rejected here.
 */
export async function resolveBookingPlace(tx: Tx, args: {
  service: ServiceForBooking;
  rawPlace: string | null;
  rawBranchId: string | null;
  rawVisitCityId: string | null;
  rawVisitAddress: string | null;
  travelFeeHalalasClient?: unknown;
}): Promise<PlaceResult> {
  const { service, rawPlace, rawBranchId, rawVisitCityId, rawVisitAddress } = args;
  const servicePlace = servicePlaceModeOf(service);
  const placeRequired =
    servicePlace === 'home' || servicePlace === 'either' || servicePlace === 'branch';
  const requestedPlace: string | null =
    rawPlace ?? (servicePlace === 'branch' && service.branchId ? 'branch' : null);

  if (placeRequired && requestedPlace !== 'home' && requestedPlace !== 'branch') {
    throw badRequest('PLACE_REQUIRED', 'اختاري مكان تقديم الخدمة (مقر أو زيارة)', {
      field: 'placeMode',
      servicePlaceMode: servicePlace,
    });
  }

  if (requestedPlace !== 'home' && requestedPlace !== 'branch') {
    return {
      placeMode: null,
      branchId: null,
      visitCityId: null,
      visitAddress: null,
      travelFeeHalalas: null,
      branchLabel: `${service.partner.nameAr} - ${service.partner.city}`,
    };
  }

  const ok =
    servicePlace === requestedPlace ||
    servicePlace === 'either' ||
    (requestedPlace === 'home' && servicePlace === 'home') ||
    (requestedPlace === 'branch' && servicePlace === 'branch');
  if (!ok) {
    throw unprocessable(
      'PLACE_NOT_ALLOWED',
      requestedPlace === 'home'
        ? 'هذه الخدمة غير معتمدة في موقع العميلة'
        : 'هذه الخدمة غير معتمدة في المقر',
    );
  }

  if (requestedPlace === 'branch') {
    return resolveBranchPlace(tx, { service, rawBranchId });
  }

  return resolveHomePlace(tx, {
    service,
    rawVisitCityId,
    rawVisitAddress,
    travelFeeHalalasClient: args.travelFeeHalalasClient,
  });
}

/** Branch place — owned + active; pinned service branch must match; never invent a foreign branch. */
export async function resolveBranchPlace(tx: Tx, args: {
  service: ServiceForBooking;
  rawBranchId: string | null;
}): Promise<BranchPlaceResult> {
  const { service, rawBranchId } = args;
  const branchId = rawBranchId || service.branchId || null;
  if (!branchId) {
    throw unprocessable('BRANCH_REQUIRED', 'اختاري فرع المقر لهذه الخدمة');
  }
  const branch = await tx.partnerBranch.findFirst({ where: { id: branchId } });
  if (!branch || branch.partnerId !== service.partnerId) {
    throw unprocessable('BRANCH_NOT_OWNED', 'هذا الفرع لا يتبع جهة الخدمة', { branchId });
  }
  if (!branch.active) {
    throw unprocessable('BRANCH_INACTIVE', 'هذا الفرع غير نشط حاليًا', { branchId });
  }
  if (service.branchId && branch.id !== service.branchId) {
    throw unprocessable('BRANCH_NOT_FOR_SERVICE', 'هذا الفرع غير مرتبط بهذه الخدمة', {
      branchId: branch.id,
      serviceBranchId: service.branchId,
    });
  }
  return {
    placeMode: 'branch',
    branchId: branch.id,
    visitCityId: null,
    visitAddress: null,
    travelFeeHalalas: null,
    branchLabel: `${branch.nameAr} - ${branch.cityNameAr}`,
  };
}

async function resolveHomePlace(tx: Tx, args: {
  service: ServiceForBooking;
  rawVisitCityId: string | null;
  rawVisitAddress: string | null;
  travelFeeHalalasClient?: unknown;
}): Promise<HomePlaceResult> {
  const { service, rawVisitCityId, rawVisitAddress } = args;
  if (!rawVisitCityId) {
    throw badRequest('VISIT_CITY_REQUIRED', 'اختاري مدينة الزيارة', { field: 'visitCityId' });
  }
  if (!rawVisitAddress || rawVisitAddress.length < 3) {
    throw badRequest('VISIT_ADDRESS_REQUIRED', 'عنوان الزيارة مطلوب', { field: 'visitAddress' });
  }
  const visitCity = resolveSaudiCity(rawVisitCityId);
  if (!visitCity) {
    throw badRequest('VISIT_CITY_INVALID', 'مدينة الزيارة غير معروفة', { field: 'visitCityId' });
  }
  const coverage =
    service.coverageJson && typeof service.coverageJson === 'object' && !Array.isArray(service.coverageJson)
      ? (service.coverageJson as { cityIds?: unknown; travelFeeSar?: unknown })
      : {};
  const coverageCityIds = Array.isArray(coverage.cityIds)
    ? coverage.cityIds.filter((x): x is string => typeof x === 'string' && !!x.trim())
    : [];
  if (!coverageIncludesCity(coverageCityIds, visitCity.id)) {
    throw unprocessable('PLACE_OUT_OF_COVERAGE', 'مدينة الزيارة خارج نطاق تغطية هذه الخدمة', {
      visitCityId: visitCity.id,
    });
  }
  const travelFeeHalalas =
    typeof coverage.travelFeeSar === 'number' && Number.isFinite(coverage.travelFeeSar) && coverage.travelFeeSar >= 0
      ? Math.round(coverage.travelFeeSar * 100)
      : null;
  if (args.travelFeeHalalasClient != null && args.travelFeeHalalasClient !== (travelFeeHalalas ?? 0)) {
    throw unprocessable('TRAVEL_FEE_MISMATCH', 'رسوم التنقل لا تطابق رسوم الخدمة', {
      expectedHalalas: travelFeeHalalas ?? 0,
    });
  }
  return {
    placeMode: 'home',
    branchId: null,
    visitCityId: visitCity.id,
    visitAddress: rawVisitAddress,
    travelFeeHalalas,
    branchLabel: `${service.partner.nameAr} - زيارة منزلية (${visitCity.nameAr})`,
  };
}

/**
 * Consecutive visit item: must accept branch place under the same rules as createBooking.
 * Home-only / disallowed place → reject the whole visit.
 */
export async function assertConsecutiveItemBranchEligible(tx: Tx, args: {
  service: ServiceForBooking;
  branchId: string;
}): Promise<BranchPlaceResult> {
  assertServiceBookableBasics(args.service);
  await assertPartnerActivityApproved(tx, args.service);
  return resolveBookingPlace(tx, {
    service: args.service,
    rawPlace: 'branch',
    rawBranchId: args.branchId,
    rawVisitCityId: null,
    rawVisitAddress: null,
  }) as Promise<BranchPlaceResult>;
}
