/**
 * FK-5 — Source discovery (repository evidence only).
 * Do NOT invent bibliographic authorities.
 */
import { SourceAuthorityTier } from './source-authority';

export const DiscoveredSourceKind = {
  REPOSITORY_ASSET: 'REPOSITORY_ASSET',
  ENGINEERING_HEURISTIC: 'ENGINEERING_HEURISTIC',
  COLOR_MATH_UTILITY: 'COLOR_MATH_UTILITY',
  TEST_ONLY_FIXTURE: 'TEST_ONLY_FIXTURE',
  EXTERNAL_AUTHORITY: 'EXTERNAL_AUTHORITY',
  SOURCING_GAP: 'SOURCING_GAP',
} as const;

export type DiscoveredSourceKind =
  (typeof DiscoveredSourceKind)[keyof typeof DiscoveredSourceKind];

export interface DiscoveredSourceRecord {
  readonly sourceId: string;
  readonly kind: DiscoveredSourceKind;
  readonly path: string;
  readonly title: string;
  readonly authorOrganization?: string;
  readonly publicationEdition?: string;
  readonly referenceLocator?: string;
  readonly domain: readonly string[];
  readonly authorityTier: SourceAuthorityTier;
  readonly copyrightSafeNotes: string;
  readonly reviewerStatus: 'NOT_REVIEWED' | 'N_A' | 'PENDING';
  readonly mayActivateProductionRule: boolean;
  readonly notes: string;
}

/**
 * Honest inventory of what exists in-repo for FK-5 sourcing.
 * EXTERNAL_AUTHORITY count is zero by design until real citations are supplied.
 */
export const FK5_DISCOVERED_SOURCES: readonly DiscoveredSourceRecord[] =
  Object.freeze([
    {
      sourceId: 'repo_assets_fashion_colors_json',
      kind: DiscoveredSourceKind.REPOSITORY_ASSET,
      path: 'assets/fashion/colors.json',
      title: 'Mira fashion color swatch catalog',
      authorOrganization: 'Mira (generated)',
      referenceLocator: 'scripts/generate_fashion_colors.py',
      domain: ['COLOR'],
      authorityTier: SourceAuthorityTier.TIER_D,
      copyrightSafeNotes: 'Internal generated swatches; not a cited theory text',
      reviewerStatus: 'N_A',
      mayActivateProductionRule: false,
      notes: 'Catalog data only — no color-theory authority',
    },
    {
      sourceId: 'repo_assets_fashion_ontology_json',
      kind: DiscoveredSourceKind.REPOSITORY_ASSET,
      path: 'assets/fashion/ontology.json',
      title: 'Mira fashion ontology (formality/occasion keys)',
      authorOrganization: 'Mira',
      domain: ['OCCASION', 'DRESS_CODE'],
      authorityTier: SourceAuthorityTier.TIER_D,
      copyrightSafeNotes: 'Internal taxonomy keys only',
      reviewerStatus: 'N_A',
      mayActivateProductionRule: false,
      notes: 'Taxonomy scaffolding — not dress-code authority',
    },
    {
      sourceId: 'repo_assets_fashion_compatibility_json',
      kind: DiscoveredSourceKind.REPOSITORY_ASSET,
      path: 'assets/fashion/compatibility.json',
      title: 'SKU compatibility pairs with whyAr',
      authorOrganization: 'Mira',
      domain: ['COLOR', 'GENERAL_STYLING'],
      authorityTier: SourceAuthorityTier.TIER_D,
      copyrightSafeNotes: 'Internal SKU notes; not bibliographic',
      reviewerStatus: 'N_A',
      mayActivateProductionRule: false,
      notes: 'No sourceId/author/locator on edges',
    },
    {
      sourceId: 'repo_assets_fashion_knowledge_graph_json',
      kind: DiscoveredSourceKind.REPOSITORY_ASSET,
      path: 'assets/fashion/knowledge_graph.json',
      title: 'SKU knowledge graph edges',
      authorOrganization: 'Mira',
      domain: ['GENERAL_STYLING'],
      authorityTier: SourceAuthorityTier.TIER_D,
      copyrightSafeNotes: 'Internal graph; whyAr only',
      reviewerStatus: 'N_A',
      mayActivateProductionRule: false,
      notes: 'NOT_FOUND for citeable provenance (FK-1 audit)',
    },
    {
      sourceId: 'legacy_is_clash_pair',
      kind: DiscoveredSourceKind.ENGINEERING_HEURISTIC,
      path: 'mira-api/src/fashion-intelligence/outfit/compatibility-engine.ts',
      title: 'Legacy isClashPair short list',
      authorOrganization: 'Mira engineering',
      referenceLocator: 'isClashPair',
      domain: ['COLOR'],
      authorityTier: SourceAuthorityTier.TIER_D,
      copyrightSafeNotes: 'Internal heuristic; not curated knowledge',
      reviewerStatus: 'N_A',
      mayActivateProductionRule: false,
      notes:
        'Arbitrary pairs (red/pink, orange/red, green/red). Not FK-5 curated. Red+yellow intentionally absent.',
    },
    {
      sourceId: 'flutter_color_harmony_engine',
      kind: DiscoveredSourceKind.COLOR_MATH_UTILITY,
      path: 'lib/features/outfit_analysis/domain/intelligence/fashion_color_harmony_engine.dart',
      title: 'Flutter hue-relationship scoring (algorithmic)',
      authorOrganization: 'Mira engineering',
      domain: ['COLOR'],
      authorityTier: SourceAuthorityTier.TIER_D,
      copyrightSafeNotes:
        'Algorithm heuristic inspired by color-wheel geometry — not a cited theory text',
      reviewerStatus: 'N_A',
      mayActivateProductionRule: false,
      notes:
        'May inform additive server color-math utility; must not auto-produce good/bad outfit claims',
    },
    {
      sourceId: 'fk5_external_authority_gap_color',
      kind: DiscoveredSourceKind.SOURCING_GAP,
      path: '(none)',
      title: 'No Tier A/B color-theory bibliography in repository',
      domain: ['COLOR'],
      authorityTier: SourceAuthorityTier.TIER_D,
      copyrightSafeNotes: 'N/A — gap record',
      reviewerStatus: 'PENDING',
      mayActivateProductionRule: false,
      notes:
        'Do not invent Itten/Albers/etc. citations. Supply real materials before ACTIVE.',
    },
    {
      sourceId: 'fk5_external_authority_gap_occasion',
      kind: DiscoveredSourceKind.SOURCING_GAP,
      path: '(none)',
      title: 'No Tier A/B dress-code / occasion bibliography in repository',
      domain: ['OCCASION', 'DRESS_CODE'],
      authorityTier: SourceAuthorityTier.TIER_D,
      copyrightSafeNotes: 'N/A — gap record',
      reviewerStatus: 'PENDING',
      mayActivateProductionRule: false,
      notes:
        'Do not invent Emily Post / black-tie manuals. Supply real materials before ACTIVE.',
    },
  ]);

export function listActivatingSources(): readonly DiscoveredSourceRecord[] {
  return FK5_DISCOVERED_SOURCES.filter((s) => s.mayActivateProductionRule);
}

export function listSourcingGaps(): readonly DiscoveredSourceRecord[] {
  return FK5_DISCOVERED_SOURCES.filter(
    (s) => s.kind === DiscoveredSourceKind.SOURCING_GAP,
  );
}

export function hasExternalAuthorityForDomain(domain: string): boolean {
  return FK5_DISCOVERED_SOURCES.some(
    (s) =>
      s.kind === DiscoveredSourceKind.EXTERNAL_AUTHORITY &&
      s.mayActivateProductionRule &&
      s.domain.includes(domain),
  );
}
