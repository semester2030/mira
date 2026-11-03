import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HttpException, HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
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

@Injectable()
export class RegistryService implements OnModuleInit {
  private registry!: FieldRegistryV2;
  private registryHash = '';
  private aliases: Record<string, { canonical?: string; action?: string }> = {};

  onModuleInit() {
    this.load();
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

  metaPayload() {
    return {
      schemaVersion: EDITOR_SCHEMA_VERSION,
      registryHash: this.registryHash,
      editorV2Enabled: this.isEditorV2Enabled(),
      registry: this.registry,
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

  private allowedValueIds(field: RegistryFieldDef): Set<string> | null {
    const values = field.values;
    if (!Array.isArray(values) || values.length === 0) return null;
    const ids = new Set<string>();
    for (const entry of values) {
      if (typeof entry === 'string') ids.add(entry);
      else if (entry && typeof entry === 'object') {
        if (typeof entry.id === 'string') ids.add(entry.id);
        if (typeof entry.value === 'string') ids.add(entry.value);
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

  assertValuesBounds(values: Record<string, unknown>) {
    const bytes = Buffer.byteLength(JSON.stringify(values), 'utf8');
    if (bytes > MAX_VALUES_BYTES) {
      throw editorError(HttpStatus.BAD_REQUEST, 'VALUES_TOO_LARGE', 'حجم بيانات المسودة أكبر من الحد المسموح');
    }
    if (Object.keys(values).length > MAX_VALUES_KEYS) {
      throw editorError(HttpStatus.BAD_REQUEST, 'VALUES_TOO_MANY_KEYS', 'عدد الحقول أكبر من الحد المسموح');
    }
    if (this.depthOf(values) > MAX_VALUES_DEPTH) {
      throw editorError(HttpStatus.BAD_REQUEST, 'VALUES_TOO_DEEP', 'عمق بيانات المسودة أكبر من الحد المسموح');
    }
  }

  /**
   * Draft-mode validation: unknown fields/values rejected; no invented defaults;
   * draftRequired profile/field lists enforced only when mode=publish.
   */
  validateValues(input: {
    profile: RegistryProfile;
    values: Record<string, unknown>;
    mode: 'draft' | 'publish';
    schemaVersion: number;
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
      const def = this.fieldDef(fieldId);
      if (!def) {
        fieldErrors.push({ fieldId, code: 'REGISTRY_UNKNOWN_FIELD' });
        continue;
      }
      if (raw === null || raw === undefined) continue;
      const typeError = this.validateType(def, raw);
      if (typeError) fieldErrors.push({ fieldId, code: typeError });
    }

    if (input.mode === 'publish') {
      // Enforce explicit draftRequired lists only. Broad publishRequiredWhen markers
      // (e.g. media) are handled by materialize / submit-review separately.
      // Contract: nameAr is NOT draft-required; materialize still demands Prisma fields.
      const required = new Set<string>([
        ...(input.profile.draftRequired ?? []),
        ...Object.values(this.registry.fields)
          .filter((f) => f.draftRequired === true && allowed.has(f.id))
          .map((f) => f.id),
      ]);
      for (const fieldId of required) {
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
      const code = fieldErrors[0].code;
      throw editorError(HttpStatus.BAD_REQUEST, code, 'راجعي الحقول المحددة', { fieldErrors });
    }
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
    if (t === 'string[]' || t === 'multiSelect' || t === 'tags') {
      if (!Array.isArray(raw)) return 'FIELD_TYPE_INVALID';
      const allowedIds = this.allowedValueIds(def);
      for (const item of raw) {
        if (typeof item !== 'string') return 'FIELD_TYPE_INVALID';
        if (allowedIds && !allowedIds.has(item)) return 'REGISTRY_UNKNOWN_VALUE';
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
    // Unknown registry type: accept JSON-compatible scalars/objects but do not invent.
    return null;
  }

  /** Map localStorage / legacy answer keys into canonical ids for a template. */
  mapLegacyAnswers(templateId: string, answers: Record<string, unknown>): {
    mapped: Record<string, unknown>;
    unmapped: string[];
  } {
    const mapped: Record<string, unknown> = {};
    const unmapped: string[] = [];
    for (const [key, value] of Object.entries(answers)) {
      const aliasKey = `template.${templateId}.${key}`;
      const alias = this.aliases[aliasKey];
      if (alias?.canonical) {
        mapped[alias.canonical] = value;
        continue;
      }
      if (alias?.action === 'drop') {
        unmapped.push(key);
        continue;
      }
      // Already canonical or unknown — keep key; caller may still flag unknown template fields.
      mapped[key] = value;
    }
    return { mapped, unmapped };
  }

  normalizeServiceProfile(input: unknown): ServiceProfileDoc {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw editorError(HttpStatus.BAD_REQUEST, 'SERVICE_PROFILE_INVALID', 'بيانات قالب الخدمة غير صالحة');
    }
    const body = input as Record<string, unknown>;
    const templateId = typeof body.templateId === 'string' ? body.templateId.trim() : '';
    if (!templateId) {
      throw editorError(HttpStatus.BAD_REQUEST, 'SERVICE_PROFILE_INVALID', 'معرّف القالب مطلوب', {
        fieldErrors: [{ fieldId: 'templateId', code: 'REQUIRED' }],
      });
    }
    const templateVersion =
      typeof body.templateVersion === 'number' && Number.isInteger(body.templateVersion)
        ? body.templateVersion
        : 1;
    const priceMode = typeof body.priceMode === 'string' && body.priceMode.trim() ? body.priceMode.trim() : 'fixed';
    const answers =
      body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers)
        ? (body.answers as Record<string, unknown>)
        : {};
    this.assertValuesBounds(answers);
    return { templateId, templateVersion, priceMode, answers };
  }
}
