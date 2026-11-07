import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HttpException, HttpStatus, Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { TaxonomyService } from '../../marketplace/taxonomy/taxonomy.service';
import {
  EDITOR_SCHEMA_VERSION,
  FieldRegistryV2,
  MAX_VALUES_BYTES,
  MAX_VALUES_DEPTH,
  MAX_VALUES_KEYS,
  RegistryFieldDef,
  RegistryProfile,
  ServiceProfileDoc,
} from './registry.types';

function editorError(status: HttpStatus, code: string, messageAr: string, extra: Record<string, unknown> = {}) {
  return new HttpException({ message: messageAr, messageAr, code, ...extra }, status);
}

type TemplateField = {
  id: string;
  type: string;
  required?: boolean;
  options?: string[];
  visibleWhenField?: string | null;
  visibleWhenAnyOf?: string[];
};

type TemplateDef = {
  id: string;
  version: number;
  partnerTypes: string[];
  fields: TemplateField[];
};

const PRICE_MODES = new Set(['fixed', 'from', 'afterAssessment', 'unknown']);
const SUPPORTED_FIELD_TYPES = new Set([
  'string',
  'text',
  'number',
  'integer',
  'boolean',
  'array',
  'string[]',
  'multiSelect',
  'tags',
  'enum',
  'singleSelect',
  'select',
  'object',
  'json',
]);

@Injectable()
export class RegistryService implements OnModuleInit {
  private registry!: FieldRegistryV2;
  private registryHash = '';
  private aliases: Record<string, { canonical?: string; action?: string }> = {};
  private templates = new Map<string, TemplateDef>();

  constructor(@Optional() @Inject(TaxonomyService) private readonly taxonomy?: TaxonomyService) {}

  onModuleInit() {
    this.load();
    if (this.taxonomy) {
      // Registry may init before TaxonomyService — reload ensures doc is present.
      this.taxonomy.reload();
      const known = new Set(this.registry.profiles.map((p) => p.id));
      this.taxonomy.assertProfilesKnown(known);
    }
  }

  load() {
    const registryPath = join(__dirname, 'field-registry.v2.json');
    const raw = readFileSync(registryPath, 'utf8');
    this.registry = JSON.parse(raw) as FieldRegistryV2;
    this.registryHash = createHash('sha256').update(raw).digest('hex');
    if (this.registry.version !== EDITOR_SCHEMA_VERSION) {
      throw new Error(`Unsupported field registry version: ${this.registry.version}`);
    }
    try {
      const aliasPath = join(__dirname, 'legacy-template-aliases.json');
      this.aliases = JSON.parse(readFileSync(aliasPath, 'utf8')) as typeof this.aliases;
    } catch {
      this.aliases = {};
    }
    try {
      const catalogPath = join(__dirname, 'service-templates.catalog.json');
      const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as { templates: TemplateDef[] };
      this.templates = new Map(catalog.templates.map((t) => [t.id, t]));
    } catch {
      this.templates = new Map();
    }
  }

  isEditorV2Enabled(): boolean {
    const raw = (process.env.MIRA_PARTNER_EDITOR_V2 ?? 'false').trim().toLowerCase();
    return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
  }

  assertEditorV2Enabled() {
    if (!this.isEditorV2Enabled()) {
      throw editorError(HttpStatus.FORBIDDEN, 'EDITOR_V2_DISABLED', 'محرر الشريك v2 غير مفعّل على الخادم');
    }
  }

  getHash() {
    return this.registryHash;
  }

  getRegistry(): FieldRegistryV2 {
    return this.registry;
  }

  listTemplateIds(): string[] {
    return [...this.templates.keys()];
  }

  metaPayload() {
    return {
      schemaVersion: EDITOR_SCHEMA_VERSION,
      registryHash: this.registryHash,
      editorV2Enabled: this.isEditorV2Enabled(),
      registry: this.registry,
      serviceTemplateIds: this.listTemplateIds(),
    };
  }

  getProfile(profileId: string): RegistryProfile | undefined {
    return this.registry.profiles.find((p) => p.id === profileId);
  }

  assertProfileAllowed(profileId: string, partnerType: string, kind: string): RegistryProfile {
    const profile = this.getProfile(profileId);
    if (!profile) {
      throw editorError(HttpStatus.BAD_REQUEST, 'REGISTRY_UNKNOWN_PROFILE', 'النشاط غير معروف', {
        fieldErrors: [{ fieldId: 'profileId', code: 'REGISTRY_UNKNOWN_PROFILE' }],
      });
    }
    if (profile.enabledByDefault === false || profile.phase === 'FUTURE_EXTENSION') {
      throw editorError(HttpStatus.BAD_REQUEST, 'REGISTRY_PROFILE_DISABLED', 'هذا النشاط غير مفعّل بعد', {
        fieldErrors: [{ fieldId: 'profileId', code: 'REGISTRY_PROFILE_DISABLED' }],
      });
    }
    if (profile.kind !== kind) {
      throw editorError(HttpStatus.BAD_REQUEST, 'REGISTRY_KIND_MISMATCH', 'نوع العنصر لا يطابق النشاط', {
        fieldErrors: [{ fieldId: 'kind', code: 'REGISTRY_KIND_MISMATCH' }],
      });
    }
    const allowedTypes = profile.partnerTypes ?? [];
    if (partnerType !== 'developer' && !allowedTypes.includes(partnerType)) {
      throw editorError(HttpStatus.FORBIDDEN, 'REGISTRY_PROFILE_FORBIDDEN', 'النشاط غير مسموح لنوع الشريك', {
        fieldErrors: [{ fieldId: 'profileId', code: 'REGISTRY_PROFILE_FORBIDDEN' }],
      });
    }
    return profile;
  }

  private fieldDef(fieldId: string): RegistryFieldDef | undefined {
    return this.registry.fields[fieldId];
  }

  /** Merge profile.fieldOverrides onto base field defs (activity-scoped rules). */
  private effectiveField(profile: RegistryProfile, fieldId: string): RegistryFieldDef | undefined {
    const base = this.fieldDef(fieldId);
    if (!base) return undefined;
    const overrides = (profile as RegistryProfile & { fieldOverrides?: Record<string, Partial<RegistryFieldDef>> })
      .fieldOverrides?.[fieldId];
    if (!overrides) return base;
    return { ...base, ...overrides, id: fieldId };
  }

  private allowedValueIds(field: RegistryFieldDef): Set<string> | null {
    const values = field.values;
    if (!Array.isArray(values) || values.length === 0) return null;
    const ids = new Set<string>();
    for (const entry of values) {
      if (typeof entry === 'string') ids.add(entry);
      else if (entry && typeof entry === 'object') {
        if (typeof (entry as { id?: string }).id === 'string') ids.add((entry as { id: string }).id);
        if (typeof (entry as { value?: string }).value === 'string') ids.add((entry as { value: string }).value);
      }
    }
    return ids.size ? ids : null;
  }

  private depthOf(value: unknown, depth = 0): number {
    if (value == null || typeof value !== 'object') return depth;
    if (Array.isArray(value)) {
      let max = depth + 1;
      for (const item of value) max = Math.max(max, this.depthOf(item, depth + 1));
      return max;
    }
    let max = depth + 1;
    for (const item of Object.values(value as Record<string, unknown>)) {
      max = Math.max(max, this.depthOf(item, depth + 1));
    }
    return max;
  }

  assertValuesBounds(values: Record<string, unknown>, label = 'values') {
    const bytes = Buffer.byteLength(JSON.stringify(values), 'utf8');
    if (bytes > MAX_VALUES_BYTES) {
      throw editorError(HttpStatus.BAD_REQUEST, 'VALUES_TOO_LARGE', `حجم ${label} أكبر من الحد المسموح`);
    }
    if (Object.keys(values).length > MAX_VALUES_KEYS) {
      throw editorError(HttpStatus.BAD_REQUEST, 'VALUES_TOO_MANY_KEYS', `عدد مفاتيح ${label} أكبر من الحد`);
    }
    if (this.depthOf(values) > MAX_VALUES_DEPTH) {
      throw editorError(HttpStatus.BAD_REQUEST, 'VALUES_TOO_DEEP', `عمق ${label} أكبر من الحد المسموح`);
    }
  }

  validateValues(input: {
    profile: RegistryProfile;
    values: Record<string, unknown>;
    mode: 'draft' | 'publish';
    schemaVersion: number;
    partnerType?: string;
  }) {
    if (input.schemaVersion !== EDITOR_SCHEMA_VERSION) {
      throw editorError(HttpStatus.BAD_REQUEST, 'REGISTRY_UNSUPPORTED_VERSION', 'إصدار السجل غير مدعوم', {
        fieldErrors: [{ fieldId: 'schemaVersion', code: 'REGISTRY_UNSUPPORTED_VERSION' }],
      });
    }
    this.assertValuesBounds(input.values);
    const allowed = new Set(input.profile.fields ?? []);
    const fieldErrors: Array<{ fieldId: string; code: string }> = [];

    for (const [fieldId, raw] of Object.entries(input.values)) {
      if (!allowed.has(fieldId)) {
        fieldErrors.push({ fieldId, code: 'REGISTRY_UNKNOWN_FIELD' });
        continue;
      }
      const def = this.effectiveField(input.profile, fieldId);
      if (!def) {
        fieldErrors.push({ fieldId, code: 'REGISTRY_UNKNOWN_FIELD' });
        continue;
      }
      if (raw === null || raw === undefined) continue;
      if (fieldId === 'serviceProfile') {
        try {
          this.validateServiceProfileDocument(raw, input.partnerType ?? 'salon', { requireKnownAnswers: true });
        } catch (error) {
          if (error instanceof HttpException) {
            const body = error.getResponse() as { fieldErrors?: Array<{ fieldId: string; code: string }>; code?: string };
            if (Array.isArray(body.fieldErrors)) fieldErrors.push(...body.fieldErrors.map((e) => ({ fieldId: `serviceProfile.${e.fieldId}`, code: e.code })));
            else fieldErrors.push({ fieldId: 'serviceProfile', code: body.code || 'SERVICE_PROFILE_INVALID' });
          } else {
            fieldErrors.push({ fieldId: 'serviceProfile', code: 'SERVICE_PROFILE_INVALID' });
          }
        }
        continue;
      }
      if (fieldId === 'optionsJson') {
        const err = this.validateOptionsJson(raw);
        if (err) fieldErrors.push({ fieldId, code: err });
        continue;
      }
      if (fieldId === 'variantsJson') {
        const err = this.validateVariantsJson(raw, input.values.optionsJson);
        if (err) fieldErrors.push({ fieldId, code: err });
        continue;
      }
      if (!SUPPORTED_FIELD_TYPES.has(def.type)) {
        fieldErrors.push({ fieldId, code: 'REGISTRY_UNSUPPORTED_TYPE' });
        continue;
      }
      const typeError = this.validateType(def, raw);
      if (typeError) fieldErrors.push({ fieldId, code: typeError });
    }

    if (input.mode === 'publish') {
      const required = new Set<string>([
        ...(input.profile.draftRequired ?? []),
        ...Object.values(this.registry.fields)
          .filter((f) => f.draftRequired === true && allowed.has(f.id))
          .map((f) => f.id),
      ]);
      // Conditional publish markers that apply to in-values fields (not media/booking ops).
      for (const fieldId of allowed) {
        const def = this.effectiveField(input.profile, fieldId);
        if (!def?.publishRequiredWhen) continue;
        if (this.publishRuleApplies(def.publishRequiredWhen, input.values)) {
          required.add(fieldId);
        }
      }
      // nameAr is NOT draft-required; materialize enforces Prisma fields separately.
      required.delete('media');
      required.delete('coverMediaId');
      for (const fieldId of required) {
        if (fieldId === 'nameAr') continue; // optional until materialize gate
        // Legacy createProduct allows omitted/blank externalUrl with purchaseMode=external.
        if (fieldId === 'externalUrl') continue;
        const present = Object.prototype.hasOwnProperty.call(input.values, fieldId);
        const value = input.values[fieldId];
        const empty =
          !present ||
          value === null ||
          value === undefined ||
          (typeof value === 'string' && value.trim() === '') ||
          (Array.isArray(value) && value.length === 0);
        if (empty) fieldErrors.push({ fieldId, code: 'PUBLISH_REQUIRED' });
      }
    }

    if (fieldErrors.length) {
      throw editorError(HttpStatus.BAD_REQUEST, fieldErrors[0].code, 'راجعي الحقول المحددة', { fieldErrors });
    }
  }

  private publishRuleApplies(rule: string, values: Record<string, unknown>): boolean {
    // Bare "product/service publish" markers document the full publication journey
    // (media, booking ops). They are NOT all draft-value requirements at materialize.
    // Materialize enforces Prisma gates (name/price/duration) separately.
    if (rule === 'optional' || rule === 'publish' || rule === 'product publish' || rule === 'service publish') {
      return false;
    }
    if (rule === 'purchaseMode=external') return values.purchaseMode === 'external';
    if (rule === 'internal_cod') return values.purchaseMode === 'internal_cod';
    if (rule === 'inventoryMode=product') return values.inventoryMode === 'product';
    if (rule === 'priceMode in [fixed,from]') {
      const mode = values.priceMode ?? (values.serviceProfile as { priceMode?: string } | undefined)?.priceMode;
      return mode === 'fixed' || mode === 'from';
    }
    // Booking/media/calendar operational rules are enforced on their own write paths.
    return false;
  }

  /** Nested optionsJson: [{id,labelAr,values:[{id,labelAr}]}] — null clears. */
  private validateOptionsJson(raw: unknown): string | null {
    if (raw === null) return null;
    if (!Array.isArray(raw)) return 'FIELD_TYPE_INVALID';
    if (raw.length > 32) return 'MAX_VALUE';
    const groupIds = new Set<string>();
    for (const group of raw) {
      if (!group || typeof group !== 'object' || Array.isArray(group)) return 'OPTIONS_JSON_INVALID';
      const g = group as Record<string, unknown>;
      if (typeof g.id !== 'string' || !g.id.trim()) return 'OPTIONS_JSON_INVALID';
      if (groupIds.has(g.id)) return 'OPTIONS_JSON_DUPLICATE_GROUP';
      groupIds.add(g.id);
      if (g.labelAr != null && typeof g.labelAr !== 'string') return 'OPTIONS_JSON_INVALID';
      if (!Array.isArray(g.values)) return 'OPTIONS_JSON_INVALID';
      if (g.values.length > 64) return 'MAX_VALUE';
      const valueIds = new Set<string>();
      for (const v of g.values) {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return 'OPTIONS_JSON_INVALID';
        const row = v as Record<string, unknown>;
        if (typeof row.id !== 'string' || !row.id.trim()) return 'OPTIONS_JSON_INVALID';
        if (valueIds.has(row.id)) return 'OPTIONS_JSON_DUPLICATE_VALUE';
        valueIds.add(row.id);
        if (row.labelAr != null && typeof row.labelAr !== 'string') return 'OPTIONS_JSON_INVALID';
      }
    }
    return null;
  }

  /** Nested variantsJson: manual variants only; selections must reference optionsJson value ids when provided. */
  private validateVariantsJson(raw: unknown, optionsJson: unknown): string | null {
    if (raw === null) return null;
    if (!Array.isArray(raw)) return 'FIELD_TYPE_INVALID';
    if (raw.length > 200) return 'MAX_VALUE';
    const allowedByGroup = new Map<string, Set<string>>();
    if (Array.isArray(optionsJson)) {
      for (const group of optionsJson) {
        if (!group || typeof group !== 'object') continue;
        const g = group as { id?: string; values?: Array<{ id?: string }> };
        if (!g.id || !Array.isArray(g.values)) continue;
        allowedByGroup.set(g.id, new Set(g.values.map((v) => v && v.id).filter((id): id is string => typeof id === 'string')));
      }
    }
    const variantIds = new Set<string>();
    for (const variant of raw) {
      if (!variant || typeof variant !== 'object' || Array.isArray(variant)) return 'VARIANTS_JSON_INVALID';
      const v = variant as Record<string, unknown>;
      if (typeof v.id !== 'string' || !v.id.trim()) return 'VARIANTS_JSON_INVALID';
      if (variantIds.has(v.id)) return 'VARIANTS_JSON_DUPLICATE_ID';
      variantIds.add(v.id);
      if (v.selections != null) {
        if (typeof v.selections !== 'object' || Array.isArray(v.selections)) return 'VARIANTS_JSON_INVALID';
        for (const [groupId, valueId] of Object.entries(v.selections as Record<string, unknown>)) {
          if (typeof valueId !== 'string') return 'VARIANTS_JSON_INVALID';
          if (allowedByGroup.size) {
            const allowed = allowedByGroup.get(groupId);
            if (!allowed || !allowed.has(valueId)) return 'VARIANTS_JSON_BROKEN_REF';
          }
        }
      }
      if (v.priceHalalas != null && (typeof v.priceHalalas !== 'number' || !Number.isInteger(v.priceHalalas))) {
        return 'VARIANTS_JSON_INVALID';
      }
      if (v.available != null && typeof v.available !== 'boolean') return 'VARIANTS_JSON_INVALID';
    }
    return null;
  }

  private validateType(def: RegistryFieldDef, raw: unknown): string | null {
    const t = def.type;
    if (t === 'string' || t === 'text') {
      if (typeof raw !== 'string') return 'FIELD_TYPE_INVALID';
      if (def.min != null && raw.trim().length < def.min) return 'MIN_VALUE';
      if (def.max != null && raw.length > def.max) return 'MAX_VALUE';
      return null;
    }
    if (t === 'number' || t === 'integer') {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return 'FIELD_TYPE_INVALID';
      if (t === 'integer' && !Number.isInteger(raw)) return 'FIELD_TYPE_INVALID';
      if (def.min != null && raw < def.min) return 'MIN_VALUE';
      if (def.max != null && raw > def.max) return 'MAX_VALUE';
      return null;
    }
    if (t === 'boolean') {
      return typeof raw === 'boolean' ? null : 'FIELD_TYPE_INVALID';
    }
    if (t === 'array' || t === 'string[]' || t === 'multiSelect' || t === 'tags') {
      if (!Array.isArray(raw)) return 'FIELD_TYPE_INVALID';
      if (def.min != null && raw.length < def.min) return 'MIN_VALUE';
      if (def.max != null && raw.length > def.max) return 'MAX_VALUE';
      const allowedIds = this.allowedValueIds(def);
      // Calendar/schedule fields (weeklyHours, dateExceptions, resources) store object rows.
      // Only enforce string-enum membership when the field declares a closed value set.
      if (!allowedIds) {
        for (const item of raw) {
          if (item == null) return 'FIELD_TYPE_INVALID';
          const ok =
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean' ||
            (typeof item === 'object' && !Array.isArray(item));
          if (!ok) return 'FIELD_TYPE_INVALID';
        }
        return null;
      }
      for (const item of raw) {
        if (typeof item !== 'string') return 'FIELD_TYPE_INVALID';
        if (!allowedIds.has(item)) return 'REGISTRY_UNKNOWN_VALUE';
      }
      return null;
    }
    if (t === 'enum' || t === 'singleSelect' || t === 'select') {
      if (typeof raw !== 'string') return 'FIELD_TYPE_INVALID';
      const allowedIds = this.allowedValueIds(def);
      if (allowedIds && !allowedIds.has(raw)) return 'REGISTRY_UNKNOWN_VALUE';
      return null;
    }
    if (t === 'object' || t === 'json') {
      return raw != null && typeof raw === 'object' && !Array.isArray(raw) ? null : 'FIELD_TYPE_INVALID';
    }
    return 'REGISTRY_UNSUPPORTED_TYPE';
  }

  /** Map localStorage / legacy answer keys into Flutter-compatible storage ids. */
  mapLegacyAnswers(templateId: string, answers: Record<string, unknown>): {
    mapped: Record<string, unknown>;
    unmapped: string[];
  } {
    const mapped: Record<string, unknown> = {};
    const unmapped: string[] = [];
    const reverseCamel: Record<string, string> = {
      included: 'includes',
      excluded: 'excludes',
      packageSessions: 'package_sessions',
      placeMode: 'place_mode',
      homeCoverage: 'home_coverage',
      needsAssessment: 'needs_assessment',
      assessmentNote: 'assessment_note',
      prepRequired: 'prep_required',
    };
    for (const [key, value] of Object.entries(answers)) {
      const aliasKey = `template.${templateId}.${key}`;
      const alias = this.aliases[aliasKey];
      if (alias?.action === 'drop') {
        unmapped.push(key);
        continue;
      }
      let dest = key;
      if (alias?.canonical) dest = alias.canonical;
      else if (reverseCamel[key]) dest = reverseCamel[key];
      mapped[dest] = value;
    }
    return { mapped, unmapped };
  }

  validateServiceProfileDocument(
    input: unknown,
    partnerType: string,
    opts: { requireKnownAnswers: boolean },
  ): ServiceProfileDoc {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw editorError(HttpStatus.BAD_REQUEST, 'SERVICE_PROFILE_INVALID', 'بيانات قالب الخدمة غير صالحة');
    }
    const body = input as Record<string, unknown>;
    this.assertValuesBounds(body, 'serviceProfile');
    const templateId = typeof body.templateId === 'string' ? body.templateId.trim() : '';
    if (!templateId) {
      throw editorError(HttpStatus.BAD_REQUEST, 'SERVICE_PROFILE_INVALID', 'معرّف القالب مطلوب', {
        fieldErrors: [{ fieldId: 'templateId', code: 'REQUIRED' }],
      });
    }
    const template = this.templates.get(templateId);
    if (!template) {
      throw editorError(HttpStatus.BAD_REQUEST, 'SERVICE_TEMPLATE_UNKNOWN', 'القالب غير موجود', {
        fieldErrors: [{ fieldId: 'templateId', code: 'SERVICE_TEMPLATE_UNKNOWN' }],
      });
    }
    if (partnerType !== 'developer' && !(template.partnerTypes || []).includes(partnerType)) {
      throw editorError(HttpStatus.FORBIDDEN, 'SERVICE_TEMPLATE_FORBIDDEN', 'القالب غير مسموح لنوع الشريك', {
        fieldErrors: [{ fieldId: 'templateId', code: 'SERVICE_TEMPLATE_FORBIDDEN' }],
      });
    }
    if (typeof body.templateVersion !== 'number' || !Number.isInteger(body.templateVersion) || body.templateVersion < 1) {
      throw editorError(HttpStatus.BAD_REQUEST, 'SERVICE_TEMPLATE_VERSION_INVALID', 'إصدار القالب غير صالح', {
        fieldErrors: [{ fieldId: 'templateVersion', code: 'SERVICE_TEMPLATE_VERSION_INVALID' }],
      });
    }
    const supportedVersion = Number(template.version || 1);
    if (body.templateVersion !== supportedVersion) {
      throw editorError(HttpStatus.BAD_REQUEST, 'SERVICE_TEMPLATE_VERSION_UNSUPPORTED', 'إصدار القالب غير مدعوم', {
        fieldErrors: [{ fieldId: 'templateVersion', code: 'SERVICE_TEMPLATE_VERSION_UNSUPPORTED' }],
      });
    }
    const priceMode = typeof body.priceMode === 'string' ? body.priceMode.trim() : '';
    if (!PRICE_MODES.has(priceMode)) {
      throw editorError(HttpStatus.BAD_REQUEST, 'SERVICE_PRICE_MODE_INVALID', 'طريقة السعر غير معروفة', {
        fieldErrors: [{ fieldId: 'priceMode', code: 'SERVICE_PRICE_MODE_INVALID' }],
      });
    }
    if (Object.prototype.hasOwnProperty.call(body, 'answers') && body.answers != null) {
      if (typeof body.answers !== 'object' || Array.isArray(body.answers)) {
        throw editorError(HttpStatus.BAD_REQUEST, 'SERVICE_ANSWERS_TYPE_INVALID', 'إجابات القالب يجب أن تكون كائنًا', {
          fieldErrors: [{ fieldId: 'answers', code: 'SERVICE_ANSWERS_TYPE_INVALID' }],
        });
      }
    }
    const answersRaw =
      body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)
        ? (body.answers as Record<string, unknown>)
        : {};
    this.assertValuesBounds(answersRaw, 'serviceProfile.answers');
    const { mapped } = this.mapLegacyAnswers(templateId, answersRaw);
    const fieldById = new Map(template.fields.map((f) => [f.id, f]));
    const fieldErrors: Array<{ fieldId: string; code: string }> = [];
    for (const [key, raw] of Object.entries(mapped)) {
      const field = fieldById.get(key);
      if (!field) {
        if (opts.requireKnownAnswers) fieldErrors.push({ fieldId: key, code: 'TEMPLATE_UNKNOWN_ANSWER' });
        continue;
      }
      const err = this.validateTemplateAnswer(field, raw);
      if (err) fieldErrors.push({ fieldId: key, code: err });
    }
    if (fieldErrors.length) {
      throw editorError(HttpStatus.BAD_REQUEST, fieldErrors[0].code, 'إجابات القالب غير صالحة', { fieldErrors });
    }
    return {
      templateId,
      templateVersion: body.templateVersion as number,
      priceMode,
      answers: mapped,
    };
  }

  private validateTemplateAnswer(field: TemplateField, raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const state = (raw as { state?: string }).state;
      if (state === 'unset' || state === 'notApplicable' || state === 'not_applicable') return null;
      if (Object.prototype.hasOwnProperty.call(raw, 'value')) {
        return this.validateTemplateAnswer(field, (raw as { value: unknown }).value);
      }
    }
    const t = field.type;
    if (t === 'boolean') return typeof raw === 'boolean' ? null : 'FIELD_TYPE_INVALID';
    if (t === 'number') {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return 'FIELD_TYPE_INVALID';
      if (!Number.isInteger(raw)) return 'FIELD_TYPE_INVALID';
      // Session counts and similar quantities must be positive when provided.
      if (field.id === 'package_sessions' || field.id.endsWith('_sessions') || field.id.endsWith('_count')) {
        if (raw < 1) return 'FIELD_VALUE_OUT_OF_RANGE';
      }
      if (raw < 0) return 'FIELD_VALUE_OUT_OF_RANGE';
      return null;
    }
    if (t === 'text' || t === 'string' || t === 'single') {
      if (typeof raw !== 'string') return 'FIELD_TYPE_INVALID';
      if (field.options?.length && !field.options.includes(raw)) return 'REGISTRY_UNKNOWN_VALUE';
      return null;
    }
    if (t === 'multi') {
      if (!Array.isArray(raw)) return 'FIELD_TYPE_INVALID';
      for (const item of raw) {
        if (typeof item !== 'string') return 'FIELD_TYPE_INVALID';
        if (field.options?.length && !field.options.includes(item)) return 'REGISTRY_UNKNOWN_VALUE';
      }
      return null;
    }
    return null;
  }

  normalizeServiceProfile(input: unknown, partnerType = 'salon'): ServiceProfileDoc {
    return this.validateServiceProfileDocument(input, partnerType, { requireKnownAnswers: true });
  }
}
