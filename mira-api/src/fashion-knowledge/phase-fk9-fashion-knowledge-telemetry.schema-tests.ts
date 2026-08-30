/**
 * FK-9 — Telemetry + Feedback schema tests.
 * LIKE ≠ TRUE. No auto-promotion. No registry write. Law #39.
 */
import assert from 'node:assert/strict';
import {
  FASHION_KNOWLEDGE_RELEASE,
  FASHION_TELEMETRY_SCHEMA_VERSION,
  FASHION_FEEDBACK_SCHEMA_VERSION,
  FASHION_RESEARCH_CANDIDATE_VERSION,
} from './versioning/release';
import {
  ENGINEERING_LAW_39,
  isLaw39CompatibleWithFrozenLaws,
  FashionKnowledgeEventType,
  ALL_FASHION_KNOWLEDGE_EVENT_TYPES,
  AdviceSourceMode,
  YEAR1_DEFAULT_SOURCE_MODE,
  FashionAdviceFeedbackType,
  FeedbackExplicitness,
  FeedbackSignalClass,
  PreferenceSignalToken,
  SampleSizeState,
  classifyFeedbackSignal,
  mapPreferenceSignal,
  classifySampleSize,
  notMyStyleIsPreferenceNotRuleInvalid,
  validateTelemetryEvent,
  validateFeedback,
  minimizeFeedbackText,
  assertNoImagePayload,
  aggregateFashionKnowledgeTelemetry,
  buildResearchCandidates,
  NO_AUTO_PROMOTION_POLICY,
  researchCandidateCannotActivate,
  assertNoRegistryWriteSurface,
  likeDoesNotActivate,
  dislikeDoesNotRejectRule,
  popularityDoesNotPromote,
  InMemoryFashionKnowledgeTelemetryStore,
  isFashionKnowledgeTelemetryEnabled,
  createFashionKnowledgeTelemetryService,
  FK9_CONSENT_INTEGRATION_REPORT,
  FK9_DATA_RETENTION_POLICY,
  YEAR1_RESEARCH_PIPELINE,
  FORBIDDEN_PIPELINE,
  YEAR1_12_MONTH_CHECKPOINTS,
} from './telemetry';

const CLOCK = '2026-08-10T21:00:00.000Z';
const RELEASE = FASHION_KNOWLEDGE_RELEASE;

function section(name: string, fn: () => void): void {
  fn();
  console.log(`ok ${name}`);
}

async function asection(
  name: string,
  fn: () => Promise<void>,
): Promise<void> {
  await fn();
  console.log(`ok ${name}`);
}

function baseEvent(
  partial: Partial<{
    eventId: string;
    eventType: string;
    occurredAt: string;
    sourceMode: string;
    releaseVersion: string;
    ruleIds: readonly string[];
    domains: readonly string[];
    reasonCodes: readonly string[];
    metadata: Readonly<Record<string, string | number | boolean | null>>;
    adviceCandidateId: string;
    adviceType: string;
    claimLockDecision: string;
    culturalContextPresent: boolean;
    occasionClass: string;
    subjectivity: string;
    confidenceBand: string;
    idempotencyKey: string;
    traceId: string;
    knowledgeType: string;
    alternativeId: string;
    preferenceConflict: string;
  }> & {
    eventId: string;
    eventType: string;
  },
) {
  return {
    eventId: partial.eventId,
    eventType: partial.eventType as never,
    schemaVersion: FASHION_TELEMETRY_SCHEMA_VERSION,
    occurredAt: partial.occurredAt ?? CLOCK,
    sourceMode: partial.sourceMode ?? AdviceSourceMode.MODE_B_LLM,
    releaseVersion: partial.releaseVersion ?? RELEASE,
    ruleIds: partial.ruleIds ?? [],
    domains: partial.domains ?? ['COLOR'],
    reasonCodes: partial.reasonCodes ?? [],
    metadata: partial.metadata ?? {},
    adviceCandidateId: partial.adviceCandidateId ?? 'cand_1',
    adviceType: partial.adviceType ?? 'REDUCE_CONTRAST',
    claimLockDecision: partial.claimLockDecision,
    culturalContextPresent: partial.culturalContextPresent ?? false,
    occasionClass: partial.occasionClass ?? 'wedding',
    subjectivity: partial.subjectivity ?? 'HIGH_SUBJECTIVITY',
    confidenceBand: partial.confidenceBand ?? 'MEDIUM',
    idempotencyKey: partial.idempotencyKey,
    traceId: partial.traceId ?? 'trace_1',
    knowledgeType: partial.knowledgeType ?? 'LLM_GENERAL_KNOWLEDGE',
    alternativeId: partial.alternativeId,
    preferenceConflict: partial.preferenceConflict,
  };
}

section('versions_and_law39', () => {
  assert.match(FASHION_KNOWLEDGE_RELEASE, /1\.0\.0-fashion-knowledge/);
  assert.equal(ENGINEERING_LAW_39.lawId, 39);
  assert.ok(isLaw39CompatibleWithFrozenLaws());
  assert.equal(FASHION_TELEMETRY_SCHEMA_VERSION, 'fashion-telemetry-schema-v1');
  assert.equal(FASHION_FEEDBACK_SCHEMA_VERSION, 'fashion-feedback-schema-v1');
  assert.equal(FASHION_RESEARCH_CANDIDATE_VERSION, 'fashion-research-candidate-v1');
  assert.ok(ENGINEERING_LAW_39.axioms.includes('LIKE_IS_NOT_TRUE'));
  assert.equal(likeDoesNotActivate(), true);
  assert.equal(dislikeDoesNotRejectRule(), true);
  assert.equal(popularityDoesNotPromote(), true);
});

section('event_taxonomy_complete', () => {
  assert.ok(ALL_FASHION_KNOWLEDGE_EVENT_TYPES.length >= 19);
  assert.ok(
    ALL_FASHION_KNOWLEDGE_EVENT_TYPES.includes(
      FashionKnowledgeEventType.ADVICE_GENERATED,
    ),
  );
  assert.ok(
    ALL_FASHION_KNOWLEDGE_EVENT_TYPES.includes(
      FashionKnowledgeEventType.CANDIDATE_BLOCKED,
    ),
  );
  assert.equal(YEAR1_DEFAULT_SOURCE_MODE, AdviceSourceMode.MODE_B_LLM);
});

section('event_schema_validation', () => {
  const ok = validateTelemetryEvent(baseEvent({
    eventId: 'e1',
    eventType: FashionKnowledgeEventType.ADVICE_GENERATED,
  }));
  assert.equal(ok.ok, true);

  const bad = validateTelemetryEvent(baseEvent({
    eventId: 'e2',
    eventType: 'NOT_A_TYPE' as never,
  }));
  assert.equal(bad.ok, false);

  const banned = validateTelemetryEvent(baseEvent({
    eventId: 'e3',
    eventType: FashionKnowledgeEventType.ADVICE_GENERATED,
    metadata: { imageBase64: 'abc' },
  }));
  assert.equal(banned.ok, false);
});

section('feedback_semantics', () => {
  assert.equal(
    classifyFeedbackSignal({
      feedbackType: FashionAdviceFeedbackType.WRONG_CONTEXT,
      explicitness: FeedbackExplicitness.EXPLICIT,
    }),
    FeedbackSignalClass.CONTEXT_CORRECTION_SIGNAL,
  );
  assert.equal(
    classifyFeedbackSignal({
      feedbackType: FashionAdviceFeedbackType.NOT_MY_STYLE,
      explicitness: FeedbackExplicitness.EXPLICIT,
    }),
    FeedbackSignalClass.USER_PREFERENCE_SIGNAL,
  );
  assert.equal(
    classifyFeedbackSignal({
      feedbackType: FashionAdviceFeedbackType.SAFETY_FLAG,
      explicitness: FeedbackExplicitness.EXPLICIT,
    }),
    FeedbackSignalClass.SAFETY_SIGNAL,
  );
  assert.equal(
    mapPreferenceSignal(FashionAdviceFeedbackType.PREFER_BOLDER),
    PreferenceSignalToken.BOLD_PREFERENCE,
  );
  assert.equal(notMyStyleIsPreferenceNotRuleInvalid(), true);
});

section('explicit_vs_implicit', () => {
  assert.equal(
    classifyFeedbackSignal({
      feedbackType: FashionAdviceFeedbackType.OTHER,
      explicitness: FeedbackExplicitness.IMPLICIT,
    }),
    FeedbackSignalClass.UX_SIGNAL,
  );
});

section('sample_size_states', () => {
  assert.equal(classifySampleSize(3), SampleSizeState.INSUFFICIENT_SAMPLE);
  assert.equal(classifySampleSize(20), SampleSizeState.EARLY_SIGNAL);
  assert.equal(classifySampleSize(100), SampleSizeState.MEANINGFUL_USAGE);
  assert.equal(classifySampleSize(1000), SampleSizeState.HIGH_VOLUME);
});

section('privacy_minimization', () => {
  const m = minimizeFeedbackText('email me at a@b.com phone +966501234567');
  assert.match(m, /redacted_email/);
  assert.match(m, /redacted_phone/);
  assert.equal(
    assertNoImagePayload({ imageBytes: 'xxx' }),
    false,
  );
  assert.equal(assertNoImagePayload({ adviceType: 'LIKE' }), true);
});

section('flag_default_false', () => {
  assert.equal(isFashionKnowledgeTelemetryEnabled(() => undefined), false);
});

section('consent_and_retention_documented', () => {
  assert.equal(FK9_CONSENT_INTEGRATION_REPORT.status, 'DOCUMENTED_GAP');
  assert.ok(FK9_DATA_RETENTION_POLICY.gaps.length > 0);
  assert.ok(YEAR1_RESEARCH_PIPELINE.includes('Research Candidate'));
  assert.deepEqual(FORBIDDEN_PIPELINE, ['Mode B', 'Popularity', 'ACTIVE']);
  assert.equal(YEAR1_12_MONTH_CHECKPOINTS.noAutomaticModelTraining, true);
});

section('no_promotion_policy', () => {
  assert.ok(
    NO_AUTO_PROMOTION_POLICY.forbiddenTransitions.some((t) =>
      t.includes('feedback→ACTIVE'),
    ),
  );
});

async function main(): Promise<void> {
  await asection('flag_disabled_no_record', async () => {
    const store = new InMemoryFashionKnowledgeTelemetryStore();
    const svc = createFashionKnowledgeTelemetryService({
      port: store,
      enabled: false,
    });
    const r = await svc.recordEvent(
      baseEvent({
        eventId: 'disabled_1',
        eventType: FashionKnowledgeEventType.ADVICE_GENERATED,
      }),
    );
    assert.equal(r.disabled, true);
    assert.equal((await store.loadEvents()).length, 0);
  });

  await asection('record_events_and_source_mode', async () => {
    const store = new InMemoryFashionKnowledgeTelemetryStore();
    const svc = createFashionKnowledgeTelemetryService({
      port: store,
      enabled: true,
      analyticsAllowed: true,
    });
    await svc.recordEvent(
      baseEvent({
        eventId: 'g1',
        eventType: FashionKnowledgeEventType.ADVICE_GENERATED,
        sourceMode: AdviceSourceMode.MODE_B_LLM,
      }),
    );
    await svc.recordEvent(
      baseEvent({
        eventId: 'm1',
        eventType: FashionKnowledgeEventType.MODE_B_LLM_USED,
      }),
    );
    await svc.recordEvent(
      baseEvent({
        eventId: 'p1',
        eventType: FashionKnowledgeEventType.ADVICE_PRESENTED,
      }),
    );
    const events = await svc.loadEvents();
    assert.equal(events.length, 3);
    assert.ok(events.every((e) => e.sourceMode === AdviceSourceMode.MODE_B_LLM));
  });

  await asection('claim_lock_and_blocked_telemetry', async () => {
    const store = new InMemoryFashionKnowledgeTelemetryStore();
    const svc = createFashionKnowledgeTelemetryService({
      port: store,
      enabled: true,
      analyticsAllowed: true,
    });
    await svc.recordEvent(
      baseEvent({
        eventId: 'cl1',
        eventType: FashionKnowledgeEventType.ADVICE_CLAIM_LOCKED,
        claimLockDecision: 'PASS_WITH_QUALIFICATION',
      }),
    );
    await svc.recordEvent(
      baseEvent({
        eventId: 'blk1',
        eventType: FashionKnowledgeEventType.CANDIDATE_BLOCKED,
        reasonCodes: ['ATTRACTIVENESS_CLAIM', 'BODY_JUDGMENT'],
      }),
    );
    await svc.recordEvent(
      baseEvent({
        eventId: 'q1',
        eventType: FashionKnowledgeEventType.CANDIDATE_QUALIFIED,
        claimLockDecision: 'PASS_WITH_QUALIFICATION',
      }),
    );
    const agg = await svc.queryAggregates({ clockNowIso: CLOCK });
    assert.equal(agg.blockedCount, 1);
    assert.equal(agg.qualifiedCount, 1);
    assert.ok(agg.blockedReasonSplit.ATTRACTIVENESS_CLAIM >= 1);
    assert.ok(agg.claimLockSplit.PASS_WITH_QUALIFICATION >= 1);
  });

  await asection('feedback_and_context_correction', async () => {
    const store = new InMemoryFashionKnowledgeTelemetryStore();
    const svc = createFashionKnowledgeTelemetryService({
      port: store,
      enabled: true,
      analyticsAllowed: true,
    });
    const fb = await svc.recordFeedback({
      feedbackId: 'fb1',
      adviceCandidateId: 'cand_1',
      feedbackType: FashionAdviceFeedbackType.WRONG_CONTEXT,
      explicitness: FeedbackExplicitness.EXPLICIT,
      occurredAt: CLOCK,
      freeTextMinimized: 'هذه ليست مناسبة زواج',
    });
    assert.equal(fb.recorded, true);
    assert.equal(fb.signalClass, FeedbackSignalClass.CONTEXT_CORRECTION_SIGNAL);

    const pref = await svc.recordFeedback({
      feedbackId: 'fb2',
      adviceCandidateId: 'cand_1',
      feedbackType: FashionAdviceFeedbackType.PREFER_BOLDER,
      explicitness: FeedbackExplicitness.EXPLICIT,
      occurredAt: CLOCK,
    });
    assert.equal(pref.signalClass, FeedbackSignalClass.USER_PREFERENCE_SIGNAL);
  });

  await asection('idempotency_and_duplicates', async () => {
    const store = new InMemoryFashionKnowledgeTelemetryStore();
    const svc = createFashionKnowledgeTelemetryService({
      port: store,
      enabled: true,
      analyticsAllowed: true,
    });
    const e = baseEvent({
      eventId: 'idem_1',
      eventType: FashionKnowledgeEventType.ADVICE_GENERATED,
      idempotencyKey: 'key_a',
    });
    assert.equal((await svc.recordEvent(e)).recorded, true);
    assert.equal((await svc.recordEvent(e)).duplicate, true);
    assert.equal(
      (
        await svc.recordEvent({
          ...e,
          eventId: 'idem_2',
          idempotencyKey: 'key_a',
        })
      ).duplicate,
      true,
    );
    assert.equal((await store.loadEvents()).length, 1);
  });

  await asection('out_of_order_aggregation', async () => {
    const events = [
      baseEvent({
        eventId: 'z_accept',
        eventType: FashionKnowledgeEventType.ADVICE_ACCEPTED,
        occurredAt: '2026-08-10T21:00:03.000Z',
      }),
      baseEvent({
        eventId: 'a_gen',
        eventType: FashionKnowledgeEventType.ADVICE_GENERATED,
        occurredAt: '2026-08-10T21:00:01.000Z',
      }),
      baseEvent({
        eventId: 'b_pres',
        eventType: FashionKnowledgeEventType.ADVICE_PRESENTED,
        occurredAt: '2026-08-10T21:00:02.000Z',
      }),
    ];
    const agg = aggregateFashionKnowledgeTelemetry({
      events,
      feedback: [],
      clockNowIso: CLOCK,
    });
    assert.equal(agg.generationCount, 1);
    assert.equal(agg.presentationCount, 1);
    assert.equal(agg.acceptCount, 1);
    assert.equal(agg.acceptRate, 1);
    assert.equal(agg.denominators.presentations, 1);
  });

  await asection('aggregation_denominators_and_bias_segment', async () => {
    const events = [
      baseEvent({
        eventId: 'g',
        eventType: FashionKnowledgeEventType.ADVICE_GENERATED,
        metadata: { preferenceSegment: 'bold' },
      }),
      baseEvent({
        eventId: 'p1',
        eventType: FashionKnowledgeEventType.ADVICE_PRESENTED,
        metadata: { preferenceSegment: 'bold' },
      }),
      baseEvent({
        eventId: 'p2',
        eventType: FashionKnowledgeEventType.ADVICE_PRESENTED,
        metadata: { preferenceSegment: 'calm' },
      }),
      baseEvent({
        eventId: 'a1',
        eventType: FashionKnowledgeEventType.ADVICE_ACCEPTED,
        metadata: { preferenceSegment: 'bold' },
      }),
    ];
    const agg = aggregateFashionKnowledgeTelemetry({
      events,
      feedback: [],
      clockNowIso: CLOCK,
    });
    assert.equal(agg.presentationCount, 2);
    assert.equal(agg.acceptCount, 1);
    assert.equal(agg.acceptRate, 0.5);
    assert.ok(agg.preferenceSegmentSplit.bold >= 1);
    assert.ok(agg.preferenceSegmentSplit.calm >= 1);
  });

  await asection('research_candidate_not_rule', async () => {
    const store = new InMemoryFashionKnowledgeTelemetryStore();
    const svc = createFashionKnowledgeTelemetryService({
      port: store,
      enabled: true,
      analyticsAllowed: true,
    });
    for (let i = 0; i < 5; i++) {
      await svc.recordEvent(
        baseEvent({
          eventId: `rg_${i}`,
          eventType: FashionKnowledgeEventType.ADVICE_GENERATED,
          adviceCandidateId: `cand_${i}`,
          adviceType: 'BALANCE_VOLUME',
          domains: ['PROPORTION'],
        }),
      );
      await svc.recordEvent(
        baseEvent({
          eventId: `rp_${i}`,
          eventType: FashionKnowledgeEventType.ADVICE_PRESENTED,
          adviceCandidateId: `cand_${i}`,
          adviceType: 'BALANCE_VOLUME',
          domains: ['PROPORTION'],
        }),
      );
    }
    await svc.recordEvent(
      baseEvent({
        eventId: 'ra_0',
        eventType: FashionKnowledgeEventType.ADVICE_ACCEPTED,
        adviceCandidateId: 'cand_0',
        adviceType: 'BALANCE_VOLUME',
        domains: ['PROPORTION'],
      }),
    );
    const research = await svc.buildResearchCandidates({ clockNowIso: CLOCK });
    assert.ok(research.length >= 1);
    for (const c of research) {
      assert.equal(c.status, 'NEEDS_RESEARCH');
      assert.equal(c.isFashionKnowledgeRule, false);
      assert.equal(c.canActivateRule, false);
      assert.equal(researchCandidateCannotActivate(c), true);
    }
  });

  await asection('no_registry_write_surface', async () => {
    const store = new InMemoryFashionKnowledgeTelemetryStore();
    const svc = createFashionKnowledgeTelemetryService({
      port: store,
      enabled: true,
      analyticsAllowed: true,
    });
    const guard = assertNoRegistryWriteSurface(svc);
    assert.equal(guard.ok, true);
    assert.equal(guard.forbiddenFound.length, 0);
    // Research candidates also lack activation
    const research = buildResearchCandidates({
      events: [],
      feedback: [],
      clockNowIso: CLOCK,
    });
    assert.equal(research.length, 0);
  });

  await asection('mode_a_usage_contract_active_zero', async () => {
    const store = new InMemoryFashionKnowledgeTelemetryStore();
    const svc = createFashionKnowledgeTelemetryService({
      port: store,
      enabled: true,
      analyticsAllowed: true,
    });
    // Contract exists; no synthetic production Mode A usage required
    await svc.recordEvent(
      baseEvent({
        eventId: 'no_know',
        eventType: FashionKnowledgeEventType.ADVICE_GENERATED,
        sourceMode: AdviceSourceMode.NO_KNOWLEDGE,
        ruleIds: [],
      }),
    );
    const events = await svc.loadEvents();
    assert.equal(events[0]!.sourceMode, AdviceSourceMode.NO_KNOWLEDGE);
    assert.equal(events[0]!.ruleIds.length, 0);
  });

  await asection('cultural_privacy_boolean_only', async () => {
    const v = validateTelemetryEvent(
      baseEvent({
        eventId: 'cult',
        eventType: FashionKnowledgeEventType.ADVICE_PRESENTED,
        culturalContextPresent: true,
        metadata: { culturalContextPresent: true },
      }),
    );
    assert.equal(v.ok, true);
  });

  await asection('determinism_aggregation', async () => {
    const events = [
      baseEvent({
        eventId: 'b',
        eventType: FashionKnowledgeEventType.ADVICE_PRESENTED,
        occurredAt: '2026-08-10T21:00:02.000Z',
      }),
      baseEvent({
        eventId: 'a',
        eventType: FashionKnowledgeEventType.ADVICE_GENERATED,
        occurredAt: '2026-08-10T21:00:01.000Z',
      }),
    ];
    const a = aggregateFashionKnowledgeTelemetry({
      events,
      feedback: [],
      clockNowIso: CLOCK,
    });
    const b = aggregateFashionKnowledgeTelemetry({
      events: [...events].reverse(),
      feedback: [],
      clockNowIso: CLOCK,
    });
    assert.equal(a.generationCount, b.generationCount);
    assert.equal(a.presentationCount, b.presentationCount);
    assert.equal(a.generatedAt, b.generatedAt);
  });

  await asection('performance_synthetic', async () => {
    const mk = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        baseEvent({
          eventId: `perf_${n}_${i}`,
          eventType:
            i % 3 === 0
              ? FashionKnowledgeEventType.ADVICE_GENERATED
              : i % 3 === 1
                ? FashionKnowledgeEventType.ADVICE_PRESENTED
                : FashionKnowledgeEventType.ADVICE_ACCEPTED,
          adviceCandidateId: `cand_${i % 50}`,
        }),
      );
    const t100 = Date.now();
    aggregateFashionKnowledgeTelemetry({
      events: mk(100),
      feedback: [],
      clockNowIso: CLOCK,
    });
    const d100 = Date.now() - t100;
    const t1k = Date.now();
    aggregateFashionKnowledgeTelemetry({
      events: mk(1000),
      feedback: [],
      clockNowIso: CLOCK,
    });
    const d1k = Date.now() - t1k;
    const t10k = Date.now();
    aggregateFashionKnowledgeTelemetry({
      events: mk(10000),
      feedback: [],
      clockNowIso: CLOCK,
    });
    const d10k = Date.now() - t10k;
    console.log(
      `ok performance_probe 100=${d100}ms 1000=${d1k}ms 10000=${d10k}ms`,
    );
    assert.ok(d10k < 5000);
  });

  await asection('validate_feedback_schema', async () => {
    assert.equal(
      validateFeedback({
        feedbackId: 'f',
        adviceCandidateId: 'c',
        feedbackType: FashionAdviceFeedbackType.LIKE,
        explicitness: FeedbackExplicitness.EXPLICIT,
        occurredAt: CLOCK,
      }).ok,
      true,
    );
  });

  await asection('frozen_boundary_marker', async () => {
    assert.ok(ENGINEERING_LAW_39.doesNotModify.includes('#1–#38'));
    assert.equal(typeof createFashionKnowledgeTelemetryService, 'function');
  });

  console.log('FK-9 schema tests passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
