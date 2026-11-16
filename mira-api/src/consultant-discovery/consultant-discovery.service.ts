import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { placeModeMatchesFilter } from '../marketplace/catalog-filters';
import {
  decideIntent,
  extractSignals,
  type ConsultantIntent,
  type GroundedOfferRow,
  type ImageKind,
  type SessionDiscoveryContext,
} from './intent';
import type { AttachmentCatalogCues } from './attachment-catalog-cues';

export interface ConsultantOfferCard {
  kind: 'product' | 'service';
  id: string;
  titleAr: string;
  priceSar: number | null;
  priceLabelAr: string | null;
  action: 'buy' | 'book' | 'view';
  actionLabelAr: string;
  lane: string | null;
  category: string | null;
  subcategory: string | null;
  partnerId: string | null;
  branchId: string | null;
  inStock: boolean | null;
  openPath: string;
  liveStatus?: 'published' | 'withdrawn' | 'unverifiable' | 'unknown';
  matchKind?: 'exact' | 'similar';
}

export interface ConsultantBrowseQuery {
  q: string | null;
  lane: string | null;
  lanes: string[] | null;
  kind: string | null;
  subcategory: string | null;
  city: string | null;
  priceMaxHalalas: number | null;
  priceBound: string | null;
  excludeColors: string[];
  requireFragranceFree: boolean;
  targetIds: string[];
  ruleIds: string[];
}

export interface ConsultantTurnResult {
  enabled: boolean;
  version: string;
  intent: ConsultantIntent;
  offers: ConsultantOfferCard[];
  sideOffer: ConsultantOfferCard | null;
  catalogFingerprint: string | null;
  searchFailed: boolean;
  searchErrorAr: string | null;
  noMatch: boolean;
  browseQuery: ConsultantBrowseQuery | null;
  notes: string[];
  sessionPatch: SessionDiscoveryContext | null;
}

type RulesDoc = {
  version: string;
  rules: Array<{
    ruleId: string;
    liveSourceId: string;
    liveTargetIds: string[];
    visibility?: string;
  }>;
};

@Injectable()
export class ConsultantDiscoveryService {
  private readonly rulesDoc: RulesDoc;

  constructor(
    private readonly config: ConfigService,
    private readonly marketplace: MarketplaceService,
  ) {
    const path = join(__dirname, 'rules.v1.json');
    this.rulesDoc = JSON.parse(readFileSync(path, 'utf8'));
  }

  enabled(): boolean {
    const flag = this.config.get('MIRA_CONSULTANT_DISCOVERY_V1', 'false');
    if (flag === true || flag === 1) return true;
    const text = String(flag ?? 'false').trim().toLowerCase();
    return text === 'true' || text === '1';
  }

  version(): string {
    return this.rulesDoc.version;
  }

  ruleById(ruleId: string) {
    return this.rulesDoc.rules.find((r) => r.ruleId === ruleId) ?? null;
  }

  allRules() {
    return this.rulesDoc.rules;
  }

  /** Whether this turn should short-circuit MCE with a discovery reply. */
  shouldHandleAsDiscovery(intent: ConsultantIntent): boolean {
    if (intent.kind === 'advice_only' && intent.blockers.includes('insufficient_signal')) {
      return false;
    }
    return (
      intent.kind === 'direct_product_search' ||
      intent.kind === 'direct_service_search' ||
      intent.kind === 'clarify' ||
      intent.kind === 'refuse_path' ||
      intent.kind === 'search_unavailable_note' ||
      (intent.kind === 'advice_only' &&
        (intent.blockers.includes('face_image_not_diagnosis') ||
          intent.blockers.includes('explicit_refuse') ||
          intent.blockers.includes('compare_grounded_only') ||
          intent.blockers.includes('which_fits_grounded_only') ||
          intent.blockers.includes('skin_explain_not_catalog') ||
          intent.blockers.includes('hair_advice_not_catalog')))
    );
  }

  async turn(input: {
    message: string;
    hasFaceImage?: boolean;
    imageKind?: ImageKind;
    session?: SessionDiscoveryContext | null;
    attachmentCount?: number;
    attachmentHintAr?: string;
    /** Structured cues from the current attachment bytes (not filename/message alone). */
    attachmentCues?: AttachmentCatalogCues | null;
    limit?: number;
  }): Promise<ConsultantTurnResult> {
    if (!this.enabled()) {
      return this.disabledResult();
    }

    const session = await this.refreshSessionOffers(input.session ?? null);
    const hintFromImage = this.hintFromAttachmentCues(input.attachmentCues);
    const attachmentHintAr =
      hintFromImage || input.attachmentHintAr || undefined;

    const signals = extractSignals(input.message, {
      hasFaceImage: input.hasFaceImage,
      imageKind: input.imageKind ?? input.attachmentCues?.imageKind,
      session,
      attachmentCount: input.attachmentCount,
      attachmentHintAr,
    });
    let intent = decideIntent(signals, session);
    intent = this.enrichFromRulesRegistry(intent);
    intent = this.applyExactVsSimilarLabels(intent, input.attachmentCues);

    const notes: string[] = [];
    if (!intent.saveAsPersonalPreference && (signals.babyGift || signals.giftNotForSelf)) {
      notes.push('session_only_beneficiary');
    }

    if (intent.kind === 'clarify' || intent.kind === 'advice_only' || intent.kind === 'refuse_path') {
      // Keep ordinal cards only while still talking about those offers (compare / which-fits).
      // Switching to bare advice / skin explain must not re-show shop cards; lastOffers stay in session.
      const shoppingContinuity =
        intent.blockers.includes('compare_grounded_only') ||
        intent.blockers.includes('which_fits_grounded_only');
      const liveCards = shoppingContinuity
        ? ((intent.sessionPatch?.lastOffers ?? session?.lastOffers ?? [])
            .map((o) => this.cardFromGrounded(o))
            .filter(Boolean) as ConsultantOfferCard[])
        : [];
      return {
        enabled: true,
        version: this.version(),
        intent,
        offers: liveCards,
        sideOffer: null,
        catalogFingerprint: null,
        searchFailed: false,
        searchErrorAr: null,
        noMatch: false,
        browseQuery: null,
        notes,
        sessionPatch: intent.sessionPatch ?? session,
      };
    }

    const limit = Math.min(3, Math.max(1, input.limit ?? 3));
    const priceMaxHalalas = this.toPriceMaxHalalas(intent.priceMax, intent.priceBound);
    const subcategory =
      intent.targetIds.length > 0 ? intent.targetIds.join(',') : undefined;
    const lanes =
      intent.lanes && intent.lanes.length > 0
        ? intent.lanes
        : intent.lane
          ? [intent.lane]
          : [null];

    const browseQuery: ConsultantBrowseQuery = {
      q: intent.q,
      lane: intent.lane,
      lanes: intent.lanes,
      kind: intent.kindFilter,
      subcategory: subcategory ?? null,
      city: intent.city,
      priceMaxHalalas,
      priceBound: intent.priceBound,
      excludeColors: intent.excludeColors,
      requireFragranceFree: intent.requireFragranceFree,
      targetIds: intent.targetIds,
      ruleIds: intent.ruleIds,
    };

    try {
      const merged: Record<string, unknown>[] = [];
      let fingerprint = '';
      for (const lane of lanes) {
        const browse = await this.marketplace.browse({
          q: intent.q ?? undefined,
          lane: lane ?? undefined,
          kind: intent.kindFilter ?? undefined,
          city: intent.city ?? undefined,
          subcategory,
          priceMax: priceMaxHalalas != null ? String(priceMaxHalalas) : undefined,
          inStock: intent.kindFilter === 'product' ? '1' : undefined,
          // Client-site services: catalog placeMode filter (home|either). Never invent capability.
          placeMode: intent.blockers.includes('require_home_visit_capability')
            ? 'home'
            : intent.blockers.includes('require_event_venue_capability')
              ? undefined
              : undefined,
          limit: String(Math.max(limit * 2, 6)),
          sort: 'relevance',
        });
        fingerprint = String((browse as { queryFingerprint?: string }).queryFingerprint ?? fingerprint);
        const items = Array.isArray((browse as { items?: unknown[] }).items)
          ? ((browse as { items: Record<string, unknown>[] }).items)
          : [];
        for (const it of items) {
          const id = String(it.id ?? '');
          if (id && !merged.some((m) => String(m.id) === id)) merged.push(it);
        }
      }

      let filtered = merged.filter((it) => this.passesClientConstraints(it, intent));
      // Exclusive «أقل من N»: drop items priced exactly N SAR when browse used ≤ N.
      if (intent.priceBound === 'exclusive' && intent.priceMax != null) {
        filtered = filtered.filter((it) => {
          const sar = this.itemPriceSar(it);
          return sar == null || sar < intent.priceMax!;
        });
      }

      const offers = filtered
        .slice(0, limit)
        .map((it) => this.toCard(it, intent))
        .filter(Boolean) as ConsultantOfferCard[];

      let sideOffer: ConsultantOfferCard | null = null;
      if (
        intent.sideSuggestionAr &&
        !intent.blockers.includes('dress_only') &&
        offers.length > 0
      ) {
        sideOffer = await this.browseSide(intent, offers.map((o) => o.id));
      }

      const lastOffers = offers.map((o) => ({
        id: o.id,
        kind: o.kind,
        titleAr: o.titleAr,
        priceSar: o.priceSar,
        partnerId: o.partnerId,
        inStock: o.inStock,
        matchKind: (o as ConsultantOfferCard & { matchKind?: 'exact' | 'similar' }).matchKind ?? null,
      }));
      const sessionPatch: SessionDiscoveryContext | null = intent.sessionPatch
        ? { ...intent.sessionPatch, lastOffers }
        : { q: intent.q, kindFilter: intent.kindFilter, lastOffers };

      if (offers.length === 0) {
        notes.push('no_matching_public_offers');
        return {
          enabled: true,
          version: this.version(),
          intent: {
            ...intent,
            replyAr:
              intent.replyAr +
              ' لم أجد عرضًا منشورًا مطابقًا الآن في كتالوج ميرا — يمكن تعديل قيد واحد (مثل المدينة أو الميزانية) إن رغبتِ.',
          },
          offers: [],
          sideOffer: null,
          catalogFingerprint: fingerprint,
          searchFailed: false,
          searchErrorAr: null,
          noMatch: true,
          browseQuery,
          notes,
          sessionPatch: {
            ...(intent.sessionPatch ?? {}),
            lastOffers: [],
          },
        };
      }

      return {
        enabled: true,
        version: this.version(),
        intent,
        offers,
        sideOffer,
        catalogFingerprint: fingerprint,
        searchFailed: false,
        searchErrorAr: null,
        noMatch: false,
        browseQuery,
        notes,
        sessionPatch,
      };
    } catch (e) {
      return {
        enabled: true,
        version: this.version(),
        intent: {
          ...intent,
          kind: 'search_unavailable_note',
          replyAr: 'تعذّر البحث في الكتالوج حاليًا. حاولي لاحقًا — ولن أخترع بدائل غير موجودة.',
        },
        offers: [],
        sideOffer: null,
        catalogFingerprint: null,
        searchFailed: true,
        searchErrorAr: 'تعذّر البحث في الكتالوج',
        noMatch: false,
        browseQuery,
        notes: [...notes, `search_error:${e instanceof Error ? e.message : 'unknown'}`],
        sessionPatch: intent.sessionPatch,
      };
    }
  }

  /**
   * Re-fetch live price/stock/action from getPublishedItem.
   * Distinguishes withdrawn (404) from unverifiable (network/5xx).
   */
  private async refreshSessionOffers(
    session: SessionDiscoveryContext | null,
  ): Promise<SessionDiscoveryContext | null> {
    if (!session?.lastOffers?.length) return session;
    const lastOffers: GroundedOfferRow[] = [];
    for (const o of session.lastOffers) {
      try {
        const item = (await this.marketplace.getPublishedItem(o.kind, o.id)) as Record<
          string,
          unknown
        >;
        const priceHalalas =
          typeof item.priceHalalas === 'number' && Number.isFinite(item.priceHalalas)
            ? item.priceHalalas
            : null;
        const priceSar = priceHalalas != null ? Math.round(priceHalalas) / 100 : null;
        const inStock =
          typeof item.stockAvailable === 'boolean'
            ? item.stockAvailable
            : typeof item.inStock === 'boolean'
              ? item.inStock
              : o.kind === 'service'
                ? true
                : null;
        const bookingEnabled = item.bookingEnabled === true;
        let action: 'buy' | 'book' | 'view' = 'view';
        if (o.kind === 'service') {
          action = bookingEnabled ? 'book' : 'view';
        } else if (inStock === false) {
          // Published but OOS — details only, never «اطلبي».
          action = 'view';
        } else if (item.purchaseMode === 'internal_cod' || item.purchaseMode === 'external') {
          action = 'buy';
        }
        lastOffers.push({
          ...o,
          titleAr: String(item.nameAr ?? item.titleAr ?? o.titleAr),
          priceSar,
          inStock,
          partnerId: item.partnerId != null ? String(item.partnerId) : o.partnerId,
          bookingEnabled,
          action,
          liveStatus: 'published',
        });
      } catch (err) {
        const status =
          typeof (err as { getStatus?: () => number })?.getStatus === 'function'
            ? (err as { getStatus: () => number }).getStatus()
            : ((err as { status?: number }).status ??
              (err as { statusCode?: number }).statusCode ??
              null);
        // Status wins over message text — 503 «غير متاح مؤقتًا» is unverifiable, not withdrawn.
        const withdrawn =
          err instanceof NotFoundException || status === 404;
        if (withdrawn) {
          lastOffers.push({
            ...o,
            liveStatus: 'withdrawn',
            inStock: false,
            action: 'view',
            bookingEnabled: false,
          });
        } else {
          lastOffers.push({
            ...o,
            liveStatus: 'unverifiable',
            priceSar: null,
            inStock: null,
            action: 'view',
            bookingEnabled: false,
          });
        }
      }
    }
    return { ...session, lastOffers };
  }

  private cardFromGrounded(o: GroundedOfferRow): ConsultantOfferCard | null {
    if (!o.id) return null;
    const withdrawn = o.liveStatus === 'withdrawn';
    const unverifiable = o.liveStatus === 'unverifiable';
    const oos = !withdrawn && !unverifiable && o.inStock === false;
    const action =
      withdrawn || unverifiable || oos
        ? 'view'
        : o.action === 'book' || o.action === 'buy' || o.action === 'view'
          ? o.action
          : o.kind === 'service' && o.bookingEnabled
            ? 'book'
            : 'view';
    return {
      kind: o.kind,
      id: o.id,
      titleAr: o.titleAr,
      priceSar: withdrawn || unverifiable ? null : o.priceSar,
      priceLabelAr:
        withdrawn || unverifiable || o.priceSar == null
          ? null
          : `${o.priceSar} ر.س`,
      action,
      actionLabelAr: withdrawn
        ? 'غير متاح'
        : unverifiable
          ? 'تعذّر التحقق'
          : oos
            ? 'عرض التفاصيل'
            : action === 'book'
              ? 'احجزي'
              : action === 'buy'
                ? 'اطلبي'
                : 'عرض التفاصيل',
      lane: null,
      category: null,
      subcategory: null,
      partnerId: o.partnerId ?? null,
      branchId: null,
      inStock: withdrawn ? false : unverifiable ? null : o.inStock ?? null,
      openPath: `/marketplace/catalog/${o.kind}/${encodeURIComponent(o.id)}`,
      liveStatus: o.liveStatus ?? 'unknown',
      matchKind: o.matchKind ?? undefined,
    };
  }

  private hintFromAttachmentCues(cues?: AttachmentCatalogCues | null): string | undefined {
    if (!cues || cues.source === 'none') return undefined;
    const parts = [cues.productNameAr, cues.brandAr, cues.sizeAr, cues.hairstyleAr]
      .map((s) => (s ?? '').trim())
      .filter(Boolean);
    return parts.length ? parts.join(' ') : undefined;
  }

  /**
   * Brand-alone hits stay «similar». Exact only when product name (and size if known) align.
   */
  private applyExactVsSimilarLabels(
    intent: ConsultantIntent,
    cues?: AttachmentCatalogCues | null,
  ): ConsultantIntent {
    if (!cues || intent.kind !== 'direct_product_search') return intent;
    const brandOnly = !!(cues.brandAr && !cues.productNameAr);
    if (brandOnly) {
      return {
        ...intent,
        blockers: [...intent.blockers, 'similar_brand_only_not_exact'],
        replyAr:
          intent.replyAr +
          ' تطابق اسم العلامة وحده لا يكفي لاعتباره نفس المنتج — سأعرض النتائج كـ«مشابه» حتى يتأكد الاسم والحجم.',
      };
    }
    return intent;
  }

  private enrichFromRulesRegistry(intent: ConsultantIntent): ConsultantIntent {
    const primary = intent.ruleIds.find((id) => /^R\d+/.test(id));
    if (!primary) return intent;
    const row = this.ruleById(primary);
    if (!row) return intent;
    const liveTargets = row.liveTargetIds?.length ? row.liveTargetIds : intent.targetIds;
    // Direct search for source itself uses source; side uses targets — keep intent targets if already set for search-of-source.
    if (intent.targetIds.length === 0 && liveTargets.length) {
      return { ...intent, sourceId: row.liveSourceId || intent.sourceId, targetIds: liveTargets };
    }
    if (!intent.sourceId && row.liveSourceId) {
      return { ...intent, sourceId: row.liveSourceId };
    }
    return intent;
  }

  private toPriceMaxHalalas(priceMaxSar: number | null, bound: ConsultantIntent['priceBound']): number | null {
    if (priceMaxSar == null || !Number.isFinite(priceMaxSar)) return null;
    // Browse filter is inclusive ≤ priceMaxHalalas.
    // «أقل من 300» → send 29999 so 300.00 is excluded; «حتى 300» → 30000.
    if (bound === 'exclusive') return Math.max(0, Math.round(priceMaxSar * 100) - 1);
    return Math.round(priceMaxSar * 100);
  }

  private itemPriceSar(it: Record<string, unknown>): number | null {
    const h = it.priceHalalas;
    if (typeof h === 'number' && Number.isFinite(h)) return Math.round(h) / 100;
    return null;
  }

  private passesClientConstraints(it: Record<string, unknown>, intent: ConsultantIntent): boolean {
    const blob = normalizeBlob(it);
    if (intent.excludeColors.length) {
      for (const c of intent.excludeColors) {
        if (blob.includes(normalizeBlobText(c))) return false;
      }
    }
    if (intent.excludeMetals.includes('gold') && /عيار|ذهب\b/.test(blob) === false) {
      // excluding gold *tone* (ذهبي) already handled via excludeColors; karat gold products stay if not tone-excluded
    }
    if (intent.requireFragranceFree) {
      const proven =
        /بدون عطر|بلا عطر|خالي من العطر|fragrance[- ]?free|unscented/.test(blob);
      if (!proven) return false; // missing field ≠ fragrance-free
    }
    if (intent.blockers.includes('require_karat_evidence')) {
      if (!/عيار\s*18|18k|18\s*k|عيار ١٨/.test(blob)) return false;
    }
    if (intent.blockers.includes('require_home_visit_capability')) {
      // Structured placeMode / locations only. Free-text «منزلية» (including negation) is NOT proof.
      const rawMode = resolvePublishedPlaceMode(it);
      if (!placeModeMatchesFilter(rawMode, ['home'])) return false;
    }
    if (intent.blockers.includes('require_event_venue_capability')) {
      // home / either alone are NOT venue proof — need explicit published venue capability.
      if (!hasPublishedVenueCapability(it)) return false;
    }
    if (intent.blockers.includes('prefer_independent_provider')) {
      const kind = String(it.providerKind ?? it.partnerType ?? it.accountKind ?? '').trim();
      // Unknown provider kind must not pass «فردية فقط».
      if (!kind || !/independent|individual|solo|freelancer/.test(kind)) return false;
    }
    if (intent.blockers.includes('prefer_facility_provider')) {
      const kind = String(it.providerKind ?? it.partnerType ?? it.accountKind ?? '').trim();
      if (!kind || /independent|individual|solo|freelancer/.test(kind)) return false;
    }
    return true;
  }

  private async browseSide(
    intent: ConsultantIntent,
    excludeIds: string[],
  ): Promise<ConsultantOfferCard | null> {
    try {
      const sub =
        intent.sideTargetIds.length > 0 ? intent.sideTargetIds.join(',') : undefined;
      const priceMaxHalalas = this.toPriceMaxHalalas(intent.priceMax, intent.priceBound);
      const sideBrowse = await this.marketplace.browse({
        q: intent.sideSuggestionAr ?? undefined,
        lane: intent.lane ?? undefined,
        kind: intent.kindFilter ?? undefined,
        city: intent.city ?? undefined,
        subcategory: sub,
        priceMax: priceMaxHalalas != null ? String(priceMaxHalalas) : undefined,
        limit: '3',
        sort: 'relevance',
      });
      const sideItems = Array.isArray((sideBrowse as { items?: unknown[] }).items)
        ? ((sideBrowse as { items: Record<string, unknown>[] }).items)
        : [];
      for (const it of sideItems) {
        if (!this.passesClientConstraints(it, intent)) continue;
        const card = this.toCard(it);
        if (card && !excludeIds.includes(card.id)) return card;
      }
    } catch {
      /* side optional */
    }
    return null;
  }

  private disabledResult(): ConsultantTurnResult {
    return {
      enabled: false,
      version: this.version(),
      intent: {
        kind: 'advice_only',
        ruleIds: [],
        sourceId: null,
        targetIds: [],
        lane: null,
        lanes: null,
        kindFilter: null,
        q: null,
        priceMax: null,
        priceBound: null,
        city: null,
        excludeColors: [],
        excludeMetals: [],
        requireFragranceFree: false,
        replyAr: 'مستشار الاكتشاف غير مفعّل في هذه البيئة.',
        askAr: null,
        sideSuggestionAr: null,
        sideTargetIds: [],
        blockers: ['feature_flag_off'],
        saveAsPersonalPreference: false,
        sessionPatch: null,
      },
      offers: [],
      sideOffer: null,
      catalogFingerprint: null,
      searchFailed: false,
      searchErrorAr: null,
      noMatch: false,
      browseQuery: null,
      notes: ['MIRA_CONSULTANT_DISCOVERY_V1=false'],
      sessionPatch: null,
    };
  }

  toCard(
    it: Record<string, unknown>,
    intent?: ConsultantIntent,
  ): (ConsultantOfferCard & { matchKind?: 'exact' | 'similar' }) | null {
    const kind = String(it.kind ?? '') === 'service' ? 'service' : String(it.kind ?? '') === 'product' ? 'product' : null;
    const id = String(it.id ?? '').trim();
    if (!kind || !id) return null;
    const titleAr = String(it.titleAr ?? it.nameAr ?? it.title ?? 'عرض ميرا');
    const priceLabel = typeof it.priceLabel === 'string' ? it.priceLabel : null;
    const priceSar = this.itemPriceSar(it);
    const inStock =
      typeof it.stockAvailable === 'boolean'
        ? it.stockAvailable
        : typeof it.inStock === 'boolean'
          ? it.inStock
          : null;
    const purchaseMode = it.purchaseMode != null ? String(it.purchaseMode) : null;
    const bookingEnabled = it.bookingEnabled === true;
    let action: 'buy' | 'book' | 'view' = 'view';
    if (kind === 'service') {
      // Never surface «احجزي» unless the published service supports booking.
      action = bookingEnabled ? 'book' : 'view';
    } else if (inStock === false) {
      // Published OOS: show details only — never «اطلبي».
      action = 'view';
    } else if (purchaseMode === 'internal_cod' || purchaseMode === 'external') {
      action = 'buy';
    }
    const actionLabelAr =
      action === 'book'
        ? 'احجزي'
        : action === 'buy'
          ? 'اطلبي'
          : inStock === false
            ? 'عرض التفاصيل'
            : 'عرض التفاصيل';
    const q = (intent?.q ?? '').trim();
    let matchKind: 'exact' | 'similar' | undefined;
    if (q) {
      const norm = (s: string) =>
        s
          .toLowerCase()
          .replace(/[أإآ]/g, 'ا')
          .replace(/ة/g, 'ه')
          .trim();
      const nq = norm(q);
      const nt = norm(titleAr);
      // Brand-alone or partial name share ≠ exact same SKU/size.
      if (intent?.blockers.includes('similar_brand_only_not_exact')) {
        matchKind = 'similar';
      } else if (intent?.blockers.includes('similar_product_named_search')) {
        matchKind = 'similar';
      } else if (nt === nq) {
        matchKind = 'exact';
      } else {
        // Shared substring alone (e.g. refill vs original) → similar, not exact.
        matchKind = 'similar';
      }
    }
    const displayTitle =
      matchKind === 'similar'
        ? intent?.blockers.includes('similar_product_named_search')
          ? `${titleAr} (بديل مشابه)`
          : `${titleAr} (مشابه)`
        : titleAr;
    return {
      kind,
      id,
      titleAr: displayTitle,
      priceSar,
      priceLabelAr: priceLabel ?? (priceSar != null ? `${priceSar} ر.س` : null),
      action,
      actionLabelAr,
      lane: it.lane != null ? String(it.lane) : null,
      category: it.category != null ? String(it.category) : null,
      subcategory: it.subcategory != null ? String(it.subcategory) : null,
      partnerId: it.partnerId != null ? String(it.partnerId) : null,
      branchId: it.branchId != null ? String(it.branchId) : null,
      inStock,
      openPath: `/marketplace/catalog/${kind}/${encodeURIComponent(id)}`,
      matchKind,
    };
  }
}

/** Explicit venue/hall attendance from published partner fields — not home/either alone. */
export function hasPublishedVenueCapability(it: Record<string, unknown>): boolean {
  const locs = Array.isArray(it.locations) ? it.locations.map(String) : [];
  if (locs.includes('event_venue') || locs.includes('venue')) return true;
  if (it.venueService === true || it.coversEventVenue === true || it.eventVenue === true) {
    return true;
  }
  const modes = Array.isArray(it.placeModes) ? it.placeModes.map(String) : [];
  if (modes.includes('event_venue') || modes.includes('venue')) return true;
  if (typeof it.placeMode === 'string' && /event_venue|venue/.test(it.placeMode)) return true;
  return false;
}

/** Published placeMode from partner portal — never inferred from marketing prose. */
export function resolvePublishedPlaceMode(it: Record<string, unknown>): string | null {
  if (typeof it.placeMode === 'string' && it.placeMode.trim()) {
    return it.placeMode.trim();
  }
  if (Array.isArray(it.placeModes) && it.placeModes.length === 1) {
    return String(it.placeModes[0]);
  }
  if (Array.isArray(it.locations) && it.locations.length) {
    const locs = it.locations.map(String);
    const home = locs.some((l) => l === 'client_home' || l === 'home');
    const branch = locs.some((l) => l === 'branch' || l === 'venue' || l === 'clinic_only');
    if (home && branch) return 'either';
    if (home) return 'home';
    if (branch) return 'branch';
  }
  return null;
}

function normalizeBlob(it: Record<string, unknown>): string {
  const parts = [
    it.nameAr,
    it.titleAr,
    it.descriptionAr,
    it.priceLabel,
    JSON.stringify(it.attributesJson ?? {}),
    JSON.stringify(it.optionsJson ?? {}),
    JSON.stringify(it.variantsJson ?? {}),
  ];
  return normalizeBlobText(parts.filter(Boolean).join(' '));
}

function normalizeBlobText(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ذهبي|دهبي|gold/g, 'gold');
}
