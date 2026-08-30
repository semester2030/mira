/**
 * FK-9 — Year-1 research pipeline + 12-month checkpoints (documentation as code).
 */
export const YEAR1_RESEARCH_PIPELINE = Object.freeze([
  'Mode B Candidate',
  'Telemetry',
  'User Feedback',
  'Structured Aggregation',
  'Research Candidate',
  'Human Research Queue',
  'Source Acquisition',
  'Human Review',
  'Future Mode A Rule',
] as const);

export const FORBIDDEN_PIPELINE = Object.freeze([
  'Mode B',
  'Popularity',
  'ACTIVE',
] as const);

export const YEAR1_12_MONTH_CHECKPOINTS = Object.freeze({
  MONTH_1_3: Object.freeze([
    'verify_event_integrity',
    'inspect_claim_lock_blocks',
    'collect_preference_signals',
  ]),
  MONTH_3_6: Object.freeze([
    'identify_recurring_structured_patterns',
    'create_research_candidate_queue',
  ]),
  MONTH_6_9: Object.freeze([
    'source_review_high_value_candidates',
    'compare_mode_a_coverage_gaps',
  ]),
  MONTH_9_12: Object.freeze([
    'evaluate_proprietary_knowledge_coverage',
    'prepare_curated_knowledge_expansion',
  ]),
  noAutomaticModelTraining: true,
});
