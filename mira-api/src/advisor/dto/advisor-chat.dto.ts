/**
 * FK-12 — Structured fashion context for /advisor/chat (request-side, public-safe).
 * Backward-compatible optional fields. No provider payloads / ledger / graph bodies.
 */
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AdvisorFashionGarmentFactDto {
  @IsString()
  @MaxLength(120)
  garmentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colors?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  silhouette?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  material?: string;
}

export class AdvisorFashionAccessoryFactDto {
  @IsString()
  @MaxLength(120)
  accessoryId!: string;

  @IsString()
  @MaxLength(40)
  category!: string;

  @IsString()
  @MaxLength(20)
  presence!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  colors?: string[];
}

export class AdvisorFashionContextDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdvisorFashionGarmentFactDto)
  garments?: AdvisorFashionGarmentFactDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdvisorFashionAccessoryFactDto)
  accessories?: AdvisorFashionAccessoryFactDto[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  outfitId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  occasion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dressCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  styleGoal?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferenceTokens?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  culturalContext?: string;

  @IsOptional()
  @IsBoolean()
  culturalContextExplicit?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceRefs?: string[];

  @IsOptional()
  @IsBoolean()
  evidenceStale?: boolean;
}

/**
 * Phase 9I / 9M — Face Result / Guidance context.
 *
 * Trust policy (MAJOR-9L-01 remediation):
 * - Selection refs / ids = IDENTIFIER (reconciled server-side against stored report)
 * - publicFactAr / reasonAr / contextLabelAr = UNTRUSTED_CLIENT_INPUT
 *   DTO presence ≠ evidence authority. Server MUST ignore free text when
 *   sealing canonical Face evidence (see face-intelligence-projector).
 */
export class AdvisorFaceContextDto {
  /** IDENTIFIER — selection context type */
  @IsString()
  @MaxLength(40)
  contextType!: string;

  /** IDENTIFIER — Face Intelligence analysis id (not a load key by itself) */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  analysisId?: string;

  /** IDENTIFIER — skinAnalysis row id (must match chat.analysisId ownership) */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reportRef?: string;

  /** IDENTIFIER */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  selectedResultId?: string;

  /** IDENTIFIER */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  selectedInsightId?: string;

  /** IDENTIFIER */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  selectedDetailRef?: string;

  /** IDENTIFIER — illustrative region metadata only */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  selectedRegion?: string;

  /** IDENTIFIER */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  selectedGuidanceId?: string;

  /** IDENTIFIER — must resolve to stored Face recommendation */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  frozenRecommendationRef?: string;

  /** IDENTIFIER list (hints for selection; not free-text claims) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidenceRefs?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  limitationRefs?: string[];

  /** DISPLAY_HINT — may lower confidence presentation; not a Face claim body */
  @IsOptional()
  @IsString()
  @MaxLength(240)
  confidenceQualifier?: string;

  /**
   * UNTRUSTED_CLIENT_INPUT — DEPRECATED as evidence authority (9M).
   * Retained for old-client compatibility. Server ignores for canonical seal.
   */
  @IsOptional()
  @IsString()
  @MaxLength(600)
  publicFactAr?: string;

  /**
   * UNTRUSTED_CLIENT_INPUT — DEPRECATED as evidence authority (9M).
   * Retained for old-client compatibility. Server ignores for canonical seal.
   */
  @IsOptional()
  @IsString()
  @MaxLength(400)
  reasonAr?: string;

  /** DISPLAY_HINT */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  personalizationLevel?: string;

  /** UNTRUSTED_CLIENT_INPUT / DISPLAY_HINT — never sealed as Face evidence */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contextLabelAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  resultVersion?: string;

  @IsOptional()
  @IsBoolean()
  evidenceStale?: boolean;
}

export class AdvisorChatDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  message!: string;

  @IsOptional()
  @IsString()
  analysisId?: string;

  /** FK-12 — optional structured fashion context for Claim-Locked advice. */
  @IsOptional()
  @ValidateNested()
  @Type(() => AdvisorFashionContextDto)
  fashion?: AdvisorFashionContextDto;

  /** Phase 9I — optional Face Result / Guidance context. */
  @IsOptional()
  @ValidateNested()
  @Type(() => AdvisorFaceContextDto)
  face?: AdvisorFaceContextDto;
}
