/**
 * Q4 Perception UI — renders rubric + pipeline (uses MIRA_Q4_TAXONOMY only).
 */
(function () {
  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderPerceptionSection() {
    const T = window.MIRA_Q4_TAXONOMY;
    if (!T) return;

    const scopeEl = document.getElementById('q4-perception-scope');
    if (scopeEl) {
      scopeEl.innerHTML = `
        <div class="q4-perception-grid">
          <div class="q4-perception-card pass">
            <h4>✅ مسموح (Phase A)</h4>
            <ul>${T.RECOLOR_SCOPE.allowed.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>
          <div class="q4-perception-card fail">
            <h4>⛔ ممنوع</h4>
            <ul>${T.RECOLOR_SCOPE.forbidden.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>
        </div>`;
    }

    const topoEl = document.getElementById('q4-perception-topology');
    if (topoEl) {
      topoEl.innerHTML = Object.values(T.TOPOLOGY)
        .map(
          (t) => `<div class="q4-topo-card">
            <strong>${esc(t.labelAr)}</strong> <code>${t.id}</code>
            <div style="font-size:0.82rem;color:var(--muted);margin:6px 0">${esc(t.detection)}</div>
            <div style="font-size:0.84rem"><em>أمثلة:</em> ${esc(t.examples.join(' · '))}</div>
            <div style="font-size:0.78rem;margin-top:4px">regions: ${esc(t.regionRoles.join(', '))}</div>
          </div>`,
        )
        .join('');
    }

    const rubricEl = document.getElementById('q4-perception-rubric');
    if (rubricEl) {
      rubricEl.innerHTML = `<table class="audit-table">
        <thead><tr><th>البُعد</th><th>سؤال التقييم</th><th>PASS</th><th>FAIL</th><th>رفض فوري</th></tr></thead>
        <tbody>${T.PERCEPTION_RUBRIC.map(
          (r) => `<tr class="${r.autoFail ? 'bad' : ''}">
            <td><strong>${esc(r.dimAr)}</strong><br /><code style="font-size:0.72rem">${r.id}</code></td>
            <td style="font-size:0.84rem">${esc(r.questionAr)}</td>
            <td style="font-size:0.82rem;color:#15803d">${esc(r.passAr)}</td>
            <td style="font-size:0.82rem;color:#b91c1c">${esc(r.failAr)}</td>
            <td>${r.autoFail ? '⛔' : '—'}</td>
          </tr>`,
        ).join('')}</tbody></table>`;
    }

    const pipeEl = document.getElementById('q4-perception-pipeline');
    if (pipeEl) {
      pipeEl.innerHTML = `<pre class="schema-block" style="font-size:0.78rem;line-height:1.65">صورة المستخدم
    ↓
① Perception — Geometry (FASHN) + Semantics (OpenAI) + TopologyResolver
    → pieceCount · silhouetteHint · regionRole · resolvedGarments[]
    ↓
② PASS/FAIL إدراك — topo_match · region_isolation (قبل recolor)
    ↓
③ Phase A — FASHN Edit على mask القطعة فقط (لون · لا regen)
    ↓
④ QEL — Identity · Edge · Material · Region · Color
    ↓
✅ عرض  |  ❌ QEL_REJECTED (422)</pre>`;
    }

    const statsEl = document.getElementById('q4-perception-stats');
    const scenarios = window.Q4_PHASE1_SCENARIOS || T.buildPhase1Scenarios();
    const stats = T.topologyStats(scenarios);
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="q4-p1-stat"><span class="v">${stats.one_piece}</span><span class="l">one_piece</span></div>
        <div class="q4-p1-stat"><span class="v">${stats.two_piece}</span><span class="l">two_piece</span></div>
        <div class="q4-p1-stat"><span class="v">${stats.layered}</span><span class="l">layered</span></div>
        <div class="q4-p1-stat"><span class="v">${scenarios.length}</span><span class="l">سيناريو Phase 1</span></div>`;
    }
  }

  window.initQ4Perception = function () {
    renderPerceptionSection();
  };
})();
