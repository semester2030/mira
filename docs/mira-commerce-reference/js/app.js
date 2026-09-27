(function () {
  const D = window.MIRA_STUDY;
  if (!D) {
    console.error("MIRA_STUDY missing");
    return;
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function copyText(text) {
    const done = () => toast("تم النسخ");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
      done();
    } catch (err) {
      toast("تعذر النسخ");
    }
    area.remove();
  }

  function linkHref(id) {
    const url = new URL(window.location.href);
    url.hash = id;
    return url.toString();
  }

  function idActions(id) {
    return `<span class="id-actions"><a class="id-link" href="#${esc(id)}">${esc(id)}</a>
      <button type="button" data-copy="${esc(id)}">نسخ المعرف</button>
      <button type="button" data-copy-link="${esc(id)}">نسخ الرابط</button></span>`;
  }

  function inline(text) {
    return esc(text).replace(/\{\{([A-Z]+-\d+)\}\}/g, (_, id) => idActions(id));
  }

  function badge(value) {
    const map = {
      EXISTING: "ok",
      PARTIAL: "warn",
      ABSENT_AFTER_SEARCH: "danger",
      ENABLED: "info",
      DISABLED: "danger",
      UNKNOWN: "warn",
      SOURCE_ONLY: "info",
      UNVERIFIED: "warn",
      proposed: "warn",
      "يحتاج قرارًا": "warn",
      "متطلب معتمد": "ok",
      "مقترح": "warn",
      "موجود في المصدر": "info",
      "مختبر": "ok",
      "غير متحقق": "danger",
      "بانتظار إعادة المراجعة": "warn",
      "بانتظار المراجعة": "warn",
      in_progress: "info",
      planned: "warn",
      critical: "danger",
      high: "warn",
      medium: "info",
      low: "ok",
      complete: "ok",
      partial: "warn",
      "مفتوحة": "danger",
      "قيد المعالجة": "warn",
      "معالجة بانتظار المراجعة": "info",
      "متعذرة لمانع موثق": "danger",
    };
    return `<span class="badge ${map[value] || "info"}">${esc(value)}</span>`;
  }

  function blocks(id) {
    return ((D.sectionContent || {})[id] || [])
      .map((b) => {
        if (b.type === "h3") return `<h3>${inline(b.text)}</h3>`;
        if (b.type === "list") return `<ul>${(b.items || []).map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`;
        if (b.type === "callout") return `<div class="callout">${inline(b.text)}</div>`;
        if (b.type === "proposal") return `<div class="callout proposal"><span class="badge warn">مقترح غير منفذ</span> ${inline(b.text)}</div>`;
        return `<p>${inline(b.text)}</p>`;
      })
      .join("");
  }

  function table(headers, rows) {
    return `<div class="table-wrap"><table><thead><tr>${headers
      .map((h) => `<th tabindex="0">${esc(h)}</th>`)
      .join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }

  function dashboard() {
    const p = D.project;
    const c = p.counts || {};
    return `<div class="grid">
      <div class="card"><div class="muted">حالة الدراسة</div><div class="metric metric-compact">${esc(p.studyStatus)}</div></div>
      <div class="card"><div class="muted">المرحلة</div><div class="metric">${esc(p.gate)}</div></div>
      <div class="card"><div class="muted">الإصدار</div><div class="metric metric-compact">${esc(p.studyVersion)}</div></div>
      <div class="card"><div class="muted">آخر تحديث</div><div class="metric metric-compact">${esc(p.updatedAt)}</div></div>
      <div class="card"><div class="muted">متطلبات</div><div class="metric">${esc(c.requirements)}</div></div>
      <div class="card"><div class="muted">ملاحظات</div><div class="metric">${esc(c.reviewFindings)}</div></div>
      <div class="card"><div class="muted">أدلة</div><div class="metric">${esc(c.evidence)}</div></div>
      <div class="card"><div class="muted">فجوات</div><div class="metric">${esc(c.gaps)}</div></div>
    </div>`;
  }

  function capsTable() {
    const rows = D.capabilities.map((c) => `<tr id="${esc(c.id)}" data-exist="${esc(c.existence)}" data-act="${esc(c.activation)}">
      <td>${idActions(c.id)}</td><td>${esc(c.nameAr)}</td><td>${badge(c.existence)}</td><td>${badge(c.activation)}</td>
      <td>${badge(c.verification)}</td><td>${(c.evidenceIds || []).map(idActions).join(" ")}</td><td>${esc(c.judgmentNoteAr || "")}</td></tr>`);
    return table(["المعرف", "القدرة", "الوجود", "التفعيل", "التحقق", "الأدلة", "ملاحظة الحكم"], rows);
  }

  function pausedTable() {
    const rows = D.pausedServices.map((p) => `<tr id="${esc(p.id)}">
      <td>${idActions(p.id)}</td><td>${esc(p.nameAr)}</td><td>${esc(p.classification)}</td>
      <td>${esc(p.uiHidden)}</td><td>${esc(p.serverFeatureGate)}</td><td>${esc(p.apiReachableDespiteUiHide)}</td>
      <td>${esc(p.logicCompleteness)}</td><td>${esc(p.documentedReason)}</td></tr>`);
    return table(["المعرف", "الاسم", "التصنيف", "الواجهة", "بوابة الخادم", "وصول API", "اكتمال المنطق", "السبب"], rows);
  }

  function judgmentTable() {
    const rows = D.judgmentCorrections.map((j) => `<tr id="${esc(j.id)}">
      <td>${idActions(j.id)}</td><td>${esc(j.subject)}</td><td>${esc(j.beforeAr)}</td><td>${esc(j.afterAr)}</td>
      <td>${esc(j.reasonAr)}</td><td>${(j.evidenceIds || []).map(idActions).join(" ")}</td></tr>`);
    return table(["المعرف", "الموضوع", "قبل", "بعد", "السبب", "الدليل"], rows);
  }

  function traces() {
    return D.partnerTraces.map((t) => `<details id="${esc(t.id)}"><summary>${esc(t.id)} ${esc(t.titleAr)} ${badge(t.verified)}</summary>
      <div class="flow">${t.chain.map((s) => `<span>${esc(s)}</span>`).join('<span class="arrow">←</span>')}</div>
      <p>${esc(t.noteAr || "")}</p>
      <p>${(t.evidenceIds || []).map(idActions).join(" ")}</p></details>`).join("");
  }

  function categories() {
    return D.categories.map((c) => `<details id="${esc(c.id)}"><summary>${esc(c.nameAr)} <span class="badge warn">مقترح غير منفذ</span></summary>
      <p>${esc(c.logicAr)}</p>
      <p>الفلاتر: ${esc((c.filters || []).join("، "))}</p>
      <p>مصدر القيم: ${esc(c.allowedValuesSourceAr)}</p>
      <p>الوحدات: ${esc(c.unitsAr)}. الفهرسة: ${esc(c.indexAr)}</p>
      <p>الفرز: ${esc(c.sortAr)}. الترقيم: ${esc(c.paginationAr)}</p>
      <p>العدّ: ${esc(c.countAr)} الحفاظ على الحالة: ${esc(c.stateAr)} الفراغ: ${esc(c.emptyAr)}</p>
      <p>${esc(c.note || "")}</p></details>`).join("");
  }

  function example() {
    const ex = D.contracts.example;
    const rows = ex.variants.map((v) => `<tr><td>${esc(v.id)}</td><td>${esc(v.color)}</td><td>${esc(v.size)}</td><td>${esc(v.stockQty)}</td><td>${v.match ? "يطابق" : "لا يطابق"}</td></tr>`);
    return `<div class="callout proposal"><span class="badge warn">مقترح غير منفذ</span> ${esc(ex.titleAr)}</div>
      <p>${esc(ex.ruleAr)}</p>${table(["المتغير", "اللون", "المقاس", "المخزون", "النتيجة"], rows)}
      <p>عدد المنتجات المطابقة: ${esc(ex.productCount)}. ${esc(ex.clipCountAr)}</p>`;
  }

  function contracts() {
    return D.contracts.entities.map((e) => `<details><summary>${esc(e.name)} <span class="badge warn">مقترح غير منفذ</span></summary>
      <p>الموجود: ${esc(e.existsAr)}</p><p>التوسعة: ${esc(e.extendAr)}</p>
      ${table(["الحقل", "النوع", "إلزامي", "المصدر"], e.fields.map((f) => `<tr><td>${esc(f.name)}</td><td>${esc(f.type)}</td><td>${f.required ? "نعم" : "لا"}</td><td>${esc(f.source)}</td></tr>`))}
      </details>`).join("");
  }

  function mediaCost() {
    const m = D.mediaLifecycle;
    const c = D.costs;
    return `<p>${esc(m.inspectedExistingAr)}</p><ol>${m.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
      <ul>${m.playbackAr.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      <div class="callout"><strong>السعر: ${esc(c.priceStatus)}</strong> بتاريخ ${esc(c.accessDate)}</div>
      <ul>${c.equationsAr.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      <ul>${c.scenariosAr.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      <p>${esc(m.vendorAr)}</p>`;
  }

  function regulatory() {
    const rows = D.regulatory.sources.map((s) => `<tr id="${esc(s.id)}"><td>${idActions(s.id)}</td><td>${esc(s.topicAr)}</td>
      <td><a href="${esc(s.url)}">${esc(s.sourceAr)}</a><div class="muted">${esc(s.alsoUrl)}</div></td>
      <td>${esc(D.regulatory.accessDate)}</td><td>${esc(s.appliesAr)}</td><td>${esc(s.designImpactAr)}</td>
      <td>${(s.specialistQuestionsAr || []).map((q) => esc(q)).join(" — ")}</td></tr>`);
    return `<div class="callout">ليست اعتمادًا قانونيًا.</div>` + table(["المعرف", "الموضوع", "المصدر", "الاطلاع", "النطاق", "أثر التصميم", "سؤال المختص"], rows);
  }

  function reqTable() {
    const rows = D.requirements.map((r) => {
      const a = r.acceptance || {};
      return `<tr id="${esc(r.id)}"><td>${idActions(r.id)}</td><td>${esc(r.nameAr)}</td><td>${esc(r.planPlacement || "")}</td>
        <td>${esc(a.given)}</td><td>${esc(a.action)}</td><td>${esc(a.expected)}</td>
        <td>${(a.failures || []).map(esc).join("؛ ")}</td><td>${esc(a.testMethod)}</td><td>${esc(a.evidenceRequired)}</td></tr>`;
    });
    return table(["المعرف", "المتطلب", "موضعه", "المعطى", "الإجراء", "المتوقع", "الفشل", "الاختبار", "الدليل"], rows);
  }

  function gapTable() {
    const rows = D.gaps.map((g) => `<tr id="${esc(g.id)}" data-sev="${esc(g.severity)}"><td>${idActions(g.id)}</td><td>${esc(g.titleAr)}</td>
      <td>${badge(g.severity)}</td><td>${badge(g.verification || "")}</td><td>${esc(g.limitationAr || g.impactAr || "")}</td>
      <td>${(g.evidenceIds || []).map(idActions).join(" ")}</td></tr>`);
    return table(["المعرف", "الفجوة", "الخطورة", "التحقق", "الأثر أو القيد", "الأدلة"], rows);
  }

  function gates() {
    return D.roadmap.map((g) => `<details id="${esc(g.id)}"><summary>${idActions(g.id)} ${esc(g.titleAr)} ${badge(g.status)}</summary>
      <p>${esc(g.goalAr || "")}</p><p>النطاق: ${esc(g.scopeAr || "")}</p>
      <p>المتطلبات: ${(g.reqIds || []).map(idActions).join(" ") || "لا متطلبات منتج في هذه البوابة"}</p>
      <p>القرارات: ${(g.decisionIds || []).map(idActions).join(" ")}</p>
      <p>الاعتماديات: ${(g.dependsOn || []).map(idActions).join(" ") || "لا شيء"}</p>
      <p>الوحدات: ${esc((g.likelyUnits || []).join("، "))}</p>
      <p>إعادة الاستخدام: ${esc(g.reuseAr || "")}</p>
      <p>المخاطر: ${esc((g.risksAr || []).join("؛ "))}</p>
      <p>الجهد: ${esc(g.effortAr || "")}. الافتراض: ${esc(g.effortAssumptionsAr || "")}</p>
      <p>الدخول: ${esc((g.entryCriteriaAr || []).join("؛ "))}</p>
      <p>الخروج: ${esc((g.exitCriteriaAr || []).join("؛ "))}</p>
      <p>حزمة الإثبات: ${esc((g.proofPackAr || []).join("؛ "))}</p>
      <p>التراجع: ${esc(g.rollbackAr || "")}</p></details>`).join("")
      + D.scopeDecisions.map((s) => `<div class="callout" id="scope-${esc(s.reqId)}">${idActions(s.reqId)} قرار نطاق ${idActions(s.decisionId)}: ${esc(s.reasonAr)}</div>`).join("");
  }

  function decisions() {
    const rows = D.decisions.map((d) => `<tr id="${esc(d.id)}"><td>${idActions(d.id)}</td><td>${esc(d.titleAr)}</td><td>${badge(d.status)}</td><td>${esc((d.options || []).join(" | "))}</td></tr>`);
    return table(["المعرف", "القرار", "الحالة", "الخيارات"], rows);
  }

  function evidenceTable() {
    const rows = D.evidence.map((e) => `<tr id="${esc(e.id)}"><td>${idActions(e.id)}</td><td>${esc(e.claimType)}</td><td>${esc(e.freshnessRole || "")}</td><td>${esc(e.currentClaimStatus || "")}</td><td>${esc(e.claim)}</td>
      <td><a href="${esc(e.excerptFile)}">${esc(e.excerptFile)}</a></td><td>${esc(e.proves)}</td><td>${esc(e.doesNotProve)}</td><td>${esc(e.limitations)}</td></tr>`);
    return `<p>عمود الدور يفرّق baseline عن current. حالة التحقق الحالية ظاهرة في عمودها. دليل baseline الذي لم يُعَد التحقق منه لا يثبت الحالة الحالية. NOT_RUN وCURRENT_RECORDED ليسا نجاحًا شاملًا لحداثة الأدلة.</p>`
      + table(["المعرف", "النوع", "الدور", "حالة التحقق الحالي", "الادعاء", "الملف", "يثبت", "لا يثبت", "القيود"], rows);
  }

  function changelog() {
    return D.changelog.map((c) => `<details open><summary>${esc(c.version)} — ${esc(c.date)}</summary><ul>${(c.changesAr || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p class="muted">${esc(c.baselineCommit || "")}</p></details>`).join("");
  }

  function reviewControls() {
    const statuses = [...new Set(D.reviewFindings.map((r) => r.status))];
    const sevs = [...new Set(D.reviewFindings.map((r) => r.severity))];
    const units = [...new Set(D.reviewFindings.map((r) => r.unit))];
    const types = [...new Set(D.reviewFindings.map((r) => r.evidenceType))];
    const opts = (list) => `<option value="">الكل</option>` + list.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    return `<div class="filter-bar" id="reviewFilters">
      <label>الحالة<select id="fStatus">${opts(statuses)}</select></label>
      <label>الخطورة<select id="fSev">${opts(sevs)}</select></label>
      <label>الوحدة<select id="fUnit">${opts(units)}</select></label>
      <label>نوع الدليل<select id="fType">${opts(types)}</select></label>
      <button type="button" id="resetReview">إعادة ضبط الملاحظات</button>
    </div>`;
  }

  function reviews() {
    return D.reviewFindings.map((r) => `<details class="review-item" id="${esc(r.id)}" data-status="${esc(r.status)}" data-sev="${esc(r.severity)}" data-unit="${esc(r.unit)}" data-etype="${esc(r.evidenceType)}">
      <summary>${esc(r.id)} ${esc(r.titleAr)} ${badge(r.status)} ${badge(r.severity)}</summary>
      <p>المصدر: ${esc(r.source)}. الوحدة: ${esc(r.unit)}. نوع الدليل: ${esc(r.evidenceType)}.</p>
      <p>${esc(r.descriptionAr)}</p>
      <p>المتطلبات: ${(r.reqIds || []).map(idActions).join(" ") || "لا متطلب منتج مباشر"}</p>
      <p>الملفات: ${esc((r.files || []).join("، "))}</p>
      <p>الدليل السابق: ${esc(r.previousEvidenceAr)}</p>
      <p>الإجراء: ${esc(r.actionAr)}</p>
      <p>الدليل الجديد: ${(r.newEvidenceIds || []).map(idActions).join(" ") || "لا ملف دليل جديد؛ التحقق من البيانات والموقع"}</p>
      <p>التحقق: ${esc(r.verificationAr)}</p>
      <p>القيود: ${esc(r.remainingLimitsAr)}</p>
      <p>الحالة السابقة: ${esc(r.previousStatus)}. آخر تحديث: ${esc(r.updatedAt)}.</p>
      ${r.parentId ? `<p>تتبع: ${idActions(r.parentId)}</p>` : ""}
    </details>`).join("");
  }

  function coverage() {
    const rows = D.scopeCoverage.map((s) => `<tr id="${esc(s.id)}"><td>${idActions(s.id)}</td><td>${esc(s.titleAr)}</td>
      <td><a href="#${esc(s.sectionId)}">${esc(s.sectionId)}</a></td><td>${esc((s.dataFiles || []).join("، "))}</td>
      <td>${(s.evidenceIds || []).map(idActions).join(" ")}</td><td>${badge(s.status)}</td>
      <td>${esc(s.remainingAr)}</td><td>${esc(s.whyAr)}</td><td>${esc(s.approvalEffectAr)}</td></tr>`);
    return table(["البند", "المطلوب", "القسم", "البيانات", "الأدلة", "الاكتمال", "الناقص", "السبب", "أثر الاعتماد"], rows);
  }

  function placeFilters() {
    const items = (D.placesAdoption && D.placesAdoption.items) || [];
    const statuses = [...new Set(items.map((i) => i.status))];
    const domains = [...new Set(items.map((i) => i.domain))];
    const opts = (list) => `<option value="">الكل</option>` + list.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    return `<div class="filter-bar" id="placeFilters">
      <label>حالة البند<select id="pStatus">${opts(statuses)}</select></label>
      <label>المجال<select id="pDomain">${opts(domains)}</select></label>
      <button type="button" id="resetPlaces">إعادة ضبط بنود الأماكن</button>
    </div>`;
  }

  function placeItems(section) {
    const items = ((D.placesAdoption && D.placesAdoption.items) || []).filter((i) => !section || i.section === section);
    return items.map((i) => `<details class="place-item" id="${esc(i.id)}" data-status="${esc(i.status)}" data-domain="${esc(i.domain)}">
      <summary>${idActions(i.id)} ${esc(i.title)} ${badge(i.status)} ${badge(i.domain)}</summary>
      <p>${esc(i.detail)}</p></details>`).join("");
  }

  function matrixTable() {
    const rows = ((D.placesAdoption && D.placesAdoption.matrix) || []).map((m) => `<tr>
      <td>${esc(m.component)}</td><td>${esc(m.source)}</td><td>${esc(m.deps)}</td><td>${esc(m.miraUse)}</td>
      <td>${esc(m.action)}</td><td>${esc(m.evidence)}</td><td>${badge(m.status)}</td></tr>`);
    return table(["المكون", "المصدر", "الاعتماديات", "استخدامه في ميرا", "الإجراء", "الدليل", "الحالة"], rows);
  }

  function viewsBlock() {
    const spec = ((D.placesAdoption && D.placesAdoption.viewsSpec) || []).map((s) => `<tr id="view-${esc(s.topic)}"><td>${esc(s.topic)}</td><td>${esc(s.text)}</td><td>${badge(s.status)}</td></tr>`);
    const ev = ((D.placesAdoption && D.placesAdoption.events) || []).map((s) => `<tr><td>${esc(s.event)}</td><td>${esc(s.meaning)}</td><td>${badge(s.status)}</td></tr>`);
    return table(["موضوع المواصفة", "النص", "الحالة"], spec) + table(["الحدث", "المعنى", "الحالة"], ev);
  }

  function stageBlock() {
    return ((D.placesAdoption && D.placesAdoption.stages) || []).map((s) => `<details id="${esc(s.id)}"><summary>${idActions(s.id)} ${esc(s.title)} ${badge(s.status)} ${idActions(s.gate)}</summary>
      <p>الهدف: ${esc(s.goal)}</p>
      <p>داخل النطاق: ${esc(s.inScope)}</p>
      <p>خارج النطاق: ${esc(s.outScope)}</p>
      <p>القبول: ${esc(s.acceptance)}</p>
      <p>الدليل: ${esc(s.evidence)}</p>
      <p>المانع: ${esc(s.blocker)}</p></details>`).join("");
  }

  function visuals() {
    const items = (D.visualReferences && D.visualReferences.items) || [];
    return items.map((item) => {
      if (item.status !== "available" || !item.path) {
        return `<article class="card concept-missing" id="${esc(item.id)}">
          <h3>${esc(item.titleAr)} ${badge(item.status)}</h3>
          <p>${esc(item.descriptionAr)}</p>
          <p>الحالة: NEEDS_ASSET. لم يُدرج رابط صورة حتى لا يظهر رابط مكسور.</p>
          <p>${esc(item.searchNoteAr || "")}</p>
        </article>`;
      }
      return `<figure class="concept-figure" id="${esc(item.id)}">
        <button type="button" class="open-image" data-full="${esc(item.path)}" data-caption="${esc(item.titleAr)}">
          <img src="${esc(item.path)}" alt="${esc(item.titleAr)}" />
        </button>
        <figcaption>
          <strong>${esc(item.titleAr)}</strong> ${badge("تصور مرجعي")}
          <p>${esc(item.descriptionAr)}</p>
          <p>المسار: <code>${esc(item.path)}</code></p>
          <p>SHA-256: <code>${esc(item.sha256)}</code></p>
          <p>${esc(item.disclaimerAr)}</p>
        </figcaption>
      </figure>`;
    }).join("") + `<p>${esc((D.visualReferences && D.visualReferences.viewsNoteAr) || "")}</p>`;
  }

  function correctionsBlock() {
    const pack = D.sourceCorrections || {};
    const rows = (pack.corrections || []).map((c) => `<tr id="${esc(c.id)}">
      <td>${idActions(c.id)}</td><td>${esc(c.topic)}</td><td>${esc(c.originalFile)}</td>
      <td>${esc(c.originalStatement)}</td><td>${esc(c.correctedStatement)}</td>
      <td>${esc(c.status)}</td></tr>`);
    const archive = pack.originalArchive || {};
    return `<div class="callout">الأرشيف الأصلي لم يُعد تغليفه: ${esc(archive.name)} — ${esc(archive.sha256)}</div>
      ${table(["التصحيح", "الموضوع", "الوثيقة الأصلية", "ما في الأرشيف", "التصحيح اللاحق", "الحالة"], rows)}
      <p>${esc(pack.historicalNoteAr || "")}</p>`;
  }

  function downloadBlock() {
    const p = (D.placesAdoption && D.placesAdoption.package) || {};
    const counts = Object.entries(p.counts || {}).map(([k, v]) => `<li>${esc(k)}: ${esc(v)}</li>`).join("");
    return `<div class="card" id="places-download">
      <p>حزمة المصدر غير مضمّنة داخل الموقع حتى لا تُنسخ مرتين. هي ملف على سطح المكتب:</p>
      <p><strong>${esc(p.name)}</strong></p>
      <p>SHA-256: <code>${esc(p.sha256)}</code></p>
      <p>المكان: ${esc(p.location)}</p>
      <p>الحزمة السابقة محفوظة: ${esc(p.previousName)}</p>
      <p>SHA-256 السابقة: <code>${esc(p.previousSha256)}</code></p>
      <p>${esc(p.note)}</p>
      <ul>${counts}</ul>
      <p><a href="evidence/source/EVD-0028.txt">مقتطف مسار الاكتشاف</a></p>
      <p><a href="evidence/source/EVD-0029.txt">مقتطف المشاهدات والمرجع البصري</a></p>
      <p><a href="evidence/handoff/RC2_ZIP.txt">بطاقة اسم الحزمة وبصمتها</a></p>
      <p><a href="evidence/tests/places_plan_browser.txt">سجل اختبار هذه الجولة</a></p>
    </div>`;
  }

  function discoverPlan() {
    const plan = D.discoverPlan || {};
    const rules = (plan.independenceAr || []).map((line) => `<li>${esc(line)}</li>`).join("");
    const functions = (plan.functions || []).map((row) => `<tr id="${esc(row.id)}"><td>${esc(row.nameAr)}</td><td>${esc(row.state)}</td><td>${esc(row.detailAr)}</td><td>${esc(row.tested)}</td></tr>`).join("");
    const files = (plan.fileMap || []).map((row) => `<tr id="${esc(row.id)}"><td>${esc(row.functionAr)}</td><td><code>${esc(row.unit)}</code></td><td>${esc(row.responsibilityAr)}</td><td>${esc(row.calledByAr)}</td><td>${esc(row.decision)}</td><td>${esc(row.reasonAr)}</td><td>${esc(row.affectedAr)}</td><td>${esc(row.testAr)}</td></tr>`).join("");
    const run = plan.run || {};
    return `<p>${esc(plan.ownerDirectiveAr || "")}</p>
      <p>${esc(plan.testAuthorizationAr || "")}</p>
      <p>أمر التشغيل: <code>${esc(run.command || "")}</code></p>
      <p>الاسم: ${esc(run.name || "")}. السكربت: <code>${esc(run.script || "")}</code>. الإعداد: <code>${esc(run.launchConfig || "")}</code>.</p>
      <h3>الاستقلال عن الأماكن</h3><ul>${rules}</ul>
      <h3>مصدر البيانات</h3><p>${esc((plan.dataSource || {}).result || "")}</p>
      <p>${esc((plan.dataSource || {}).localFallback || "")}</p>
      <h3>حالة الوظائف</h3>
      <div class="table-wrap"><table><thead><tr><th>الوظيفة</th><th>الحالة</th><th>التفصيل</th><th>ما اختُبر</th></tr></thead><tbody>${functions}</tbody></table></div>
      <h3>خريطة الملفات</h3>
      <div class="table-wrap"><table><thead><tr><th>الوظيفة</th><th>الوحدة</th><th>المسؤولية</th><th>من يستدعيها</th><th>القرار</th><th>السبب</th><th>المتأثر</th><th>الاختبار</th></tr></thead><tbody>${files}</tbody></table></div>`;
  }

  function phaseList(items) {
    return `<ul>${(items || []).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
  }

  function discoverPhases() {
    const data = D.discoverPhases || {};
    const cards = (data.phases || []).map((phase) => {
      const tasks = phase.tasks || [];
      const waiting = tasks.filter((task) => task.status === "بانتظار المراجعة").length;
      const taskRows = tasks.map((task) => `<li id="${esc(task.id)}"><span class="phase-id">${esc(task.id)}</span> — ${esc(task.nameAr)} — <span class="phase-status">${esc(task.status)}</span>
          ${task.goalAr ? `<p>الهدف: ${esc(task.goalAr)}</p><p>التنفيذ: ${esc(task.implementationAr || "")}</p><p>النتيجة: ${esc(task.resultAr || "")}</p><p>الاختبارات: ${esc(task.testsAr || "")}</p><p>الأدلة: ${esc(task.evidenceAr || "")}</p>${(task.evidenceLinks || []).map((link) => `<p><a href="${esc(link.href)}">${esc(link.label || link.href)}</a></p>`).join("")}<p>المتبقي: ${esc(task.remainingAr || "")}</p>` : ""}
        </li>`).join("");
      const evidence = (phase.evidenceIds || []).map((id) => `<li><a href="#${esc(id)}">${esc(id)}</a></li>`).join("");
      const reviewLink = phase.reviewPackage ? `<p>حزمة المراجعة: <a href="${esc(phase.reviewPackage)}">${esc(phase.reviewPackageLabel || phase.reviewPackage)}</a></p>` : "";
      const verifyLink = phase.verificationReport ? `<p>تقرير التحقق: <a href="${esc(phase.verificationReport)}">${esc(phase.verificationReportLabel || phase.verificationReport)}</a></p>` : "";
      const reviewResult = phase.reviewResultAr ? `<p>نتيجة المراجعة${phase.reviewDate ? " (" + esc(phase.reviewDate) + ")" : ""}: ${esc(phase.reviewResultAr)}</p>` : "";
      const approval = `<p>الاعتماد: ${esc(phase.approvalAr || "غير معتمدة")}</p>`;
      const corrections = (phase.corrections || []).map((note) => `<article class="phase-note" id="${esc(note.id)}">
          <h4><span class="phase-id">${esc(note.id)}</span> — ${esc(note.titleAr || "")} — <span class="phase-status">${esc(note.status || "")}</span></h4>
          <p>المشكلة: ${esc(note.problemAr || "")}</p>
          <p>الهدف: ${esc(note.goalAr || note.taskAr || "")}</p>
          <p>الأثر: ${esc(note.impactAr || "")}</p>
          <p>المهمة التصحيحية: ${esc(note.taskAr || "")}</p>
          <p>الإصلاح: ${esc(note.fixAr || "")}</p>
          <p>الملفات: ${esc((note.filesAr || []).join("، "))}</p>
          <p>مرتبطة بـ: ${esc((note.relatedTaskIds || []).join("، "))}</p>
          <p>حالة التنفيذ: ${esc(note.status || "")}</p>
          <p>اختبارات القبول: ${esc(note.acceptanceAr || "")}</p>
          <p>نتيجة التنفيذ: ${esc(note.resultAr || "")}</p>
          <p>دليل الاختبار: ${esc(note.evidenceAr || "")}</p>
          ${(note.evidenceLinks || []).map((link) => `<p><a href="${esc(link.href)}">${esc(link.label || link.href)}</a></p>`).join("")}
          <p>ما بقي: ${esc(note.remainingAr || "لا شيء ضمن هذه الملاحظة")}</p>
        </article>`).join("");
      const deliveries = (phase.deliveries || []).map((item) => {
        const logLine = item.logHref
          ? `<p>سجل التسليم: <a href="${esc(item.logHref)}">${esc(item.logLabel || item.logHref)}</a></p>`
          : "";
        const zipLine = item.zipHref
          ? `<p>تنزيل ZIP: <a href="${esc(item.zipHref)}">${esc(item.zipLabel || item.zipHref)}</a></p>`
          : "";
        const shaLine = item.sha256Href
          ? `<p>تنزيل البصمة: <a href="${esc(item.sha256Href)}">${esc(item.sha256Label || item.sha256Href)}</a></p>`
          : `<p>البصمة: ${esc(item.sha256 || "تُحسب خارج الحزمة بعد إغلاقها")}</p>`;
        const verifyLine = item.verificationHref
          ? `<p>تقرير التحقق: <a href="${esc(item.verificationHref)}">${esc(item.verificationLabel || item.verificationHref)}</a></p>`
          : "";
        const finalLine = item.finalChecksHref
          ? `<p>سجل التحقق النهائي: <a href="${esc(item.finalChecksHref)}">${esc(item.finalChecksLabel || item.finalChecksHref)}</a></p>`
          : "";
        return `<article class="phase-note" id="${esc(item.id)}">
          <h4><span class="phase-id">${esc(item.id)}</span> — ${esc(item.name || "")}</h4>
          <p>تاريخ الإنشاء: ${esc(item.createdAt || "")}</p>
          <p>حالة التسليم: ${esc(item.deliveryStatus || "")}</p>
          ${logLine}${zipLine}${shaLine}${verifyLine}${finalLine}
          <p>نتيجة المراجعة: ${esc(item.reviewResultAr || "لم تصدر بعد")}</p>
          <p>الاعتماد: ${esc(item.approvalAr || "غير معتمدة")}</p>
        </article>`;
      }).join("");
      const blocker = phase.blockersAr ? `<p class="phase-block">عائق: ${esc(phase.blockersAr)}</p>` : "";
      const launchLines = (phase.launchBlockerIds || []).map((id) => {
        const row = (data.launchBlockers || []).find((item) => item.id === id);
        if (!row) return "";
        return `<p>مانع الإطلاق <a href="#${esc(row.id)}">${esc(row.id)}</a>: ${esc(row.status || "")}. التفاصيل من السجل الواحد في ملخص الجاهزية.</p>`;
      }).join("");
      return `<details class="phase-card" id="${esc(phase.id)}">
        <summary>
          <span class="phase-id">${esc(String(phase.number))}</span>
          <span>${esc(phase.nameAr)}</span>
          <span class="phase-status">${esc(phase.status)}</span>
        </summary>
        <div class="phase-body">
          <p>${esc(data.progressBasisAr || "")}</p>
          <p>المهام التي حالتها «بانتظار المراجعة»: ${waiting} من ${tasks.length}.</p>
          ${blocker}
          ${launchLines}
          <h3>الهدف</h3><p>${esc(phase.goalAr || "")}</p>
          <h3>داخل النطاق</h3>${phaseList(phase.inScopeAr)}
          <h3>خارج النطاق</h3>${phaseList(phase.outOfScopeAr)}
          <h3>المهام</h3><ul>${taskRows}</ul>
          ${(phase.testPlan || []).length ? `<h3>اختبارات المرحلة — لم تُنفذ في هذا التسليم</h3><ul>${phase.testPlan.map((item) => `<li id="${esc(item.id)}">${esc(item.titleAr)} — <span class="phase-status">${esc(item.status || "لم تبدأ")}</span></li>`).join("")}</ul>` : ""}
          ${corrections ? `<h3>ملاحظات التصحيح</h3>${corrections}` : ""}
          ${deliveries ? `<h3>التسليمات</h3>${deliveries}` : ""}
          <h3>المخرجات المتوقعة</h3><p>${esc(phase.expectedAr || "")}</p>
          <h3>النتائج الفعلية</h3><p>${esc(phase.actualAr || "")}</p>
          ${(phase.affectedFilesAr || []).length ? `<h3>الملفات المتأثرة</h3><ul>${phase.affectedFilesAr.map((file) => `<li><code>${esc(file)}</code></li>`).join("")}</ul>` : ""}
          <h3>الاعتماديات والملاحظات</h3><p>${esc(phase.dependenciesAr || "")}</p><p>${esc(phase.notesAr || "")}</p>
          <h3>شروط القبول</h3><p>${esc(phase.acceptanceAr || "")}</p>
          <h3>الأدلة</h3><ul>${evidence}</ul>
          ${reviewLink}${verifyLink}${reviewResult}${approval}
        </div>
      </details>`;
    }).join("");
    const approved = data.approvedSummaryAr ? `<p>${esc(data.approvedSummaryAr)}</p>` : "";
    const launch = (data.launchBlockers || []).map((row) => `<article class="phase-note" id="${esc(row.id)}">
        <h3>${esc(row.id)} — ${esc(row.status || "")}</h3>
        <p>المطلوب: ${esc(row.requiredAr || "")}</p>
        <p>ما اكتمل: ${esc(row.completedAr || "")}</p>
        <p>ما لم يكتمل: ${esc(row.incompleteAr || "")}</p>
        <p>موعد الإغلاق: ${esc(row.closeBeforeAr || "")}</p>
        <p>معيار الإغلاق: ${esc(row.closeCriteriaAr || "")}</p>
        <p>دليل الإغلاق المطلوب: ${esc(row.evidenceRequiredAr || "")}</p>
        <p>قرار المراجع: ${esc(row.reviewDecisionAr || "بانتظار قرار المراجع")}</p>
        <p>${esc(row.phaseFourNoteAr || "")}</p>
      </article>`).join("");
    const policy = data.viewCountPolicy ? `<article class="phase-note" id="view-count-policy">
        <h3>قرار قواعد المشاهدات — ${esc(data.viewCountPolicy.status || "")}</h3>
        <p>${esc(data.viewCountPolicy.noticeAr || "")}</p>
        <p>التوصية الرئيسية: ${esc(data.viewCountPolicy.recommendedAr || "")}</p>
        <p>البديل: ${esc(data.viewCountPolicy.alternativeAr || "")}</p>
        ${(data.viewCountPolicy.points || []).map((point) => `<h4>${esc(point.titleAr || "")}</h4><p>${esc(point.textAr || "")}</p>`).join("")}
        ${(data.viewCountPolicy.timingAr || []).map((line) => `<p>${esc(line)}</p>`).join("")}
        ${(data.viewCountPolicy.examples || []).length ? `<table><thead><tr><th>المثال</th><th>الوقائع</th><th>المشاهدات المؤهلة</th><th>الفاعلون الفريدون</th><th>سبب الفرق</th></tr></thead><tbody>${data.viewCountPolicy.examples.map((row) => `<tr><td>${esc(row.caseAr || "")}</td><td>${esc(row.factsAr || "")}</td><td>${esc(String(row.qualifiedViews ?? ""))}</td><td>${esc(String(row.uniqueActors ?? ""))}</td><td>${esc(row.differenceAr || "")}</td></tr>`).join("")}</tbody></table>` : ""}
        <p>قواعد ثابتة: ${esc((data.viewCountPolicy.fixedRulesAr || []).join(" "))}</p>
        <p>القرار المطلوب: ${esc(data.viewCountPolicy.pendingDecisionAr || "")}</p>
      </article>` : "";
    const closure = data.prePhase5Closure ? `<section id="pre-phase5-closure"><h3>${esc(data.prePhase5Closure.titleAr || "")}</h3><p>${esc(data.prePhase5Closure.noteAr || "")}</p>${(data.prePhase5Closure.items || []).map((item) => `<article class="phase-note" id="${esc(item.id)}">
        <h3><span class="phase-id">${esc(item.id)}</span> — ${esc(item.titleAr || "")} — <span class="phase-status">${esc(item.status || "")}</span></h3>
        <p>مرتبط بـ: ${(item.linkedIds || []).map((id) => `<a href="#${esc(id)}">${esc(id)}</a>`).join(" ") || ""}</p>
        <p>المسؤول: ${esc(item.ownerAr || "")}</p>
        <p>شرط الإغلاق: ${esc(item.closeWhenAr || "")}</p>
        <p>ما نُفذ: ${esc(item.doneAr || "")}</p>
        <p>ما اختُبر: ${esc(item.testedAr || "")}</p>
        <p>الدليل: ${esc(item.evidenceAr || "")}</p>
        ${(item.evidenceLinks || []).map((link) => `<p><a href="${esc(link.href)}">${esc(link.label || link.href)}</a></p>`).join("")}
        <p>المتبقي: ${esc(item.remainingAr || "")}</p>
      </article>`).join("")}</section>` : "";
    const ownerDecision = data.ownerDecisionAr ? `<p id="owner-decision-2026-09-27">${esc(data.ownerDecisionAr)}</p>` : "";
    return `<p>${esc(data.ownerConfirmationAr || "")}</p>${ownerDecision}${approved}<h3>ملخص الجاهزية</h3>${launch}<p>${esc(data.placesCopyAr || "")}</p>${policy}${closure}<div class="phase-list">${cards}</div>`;
  }

  const extras = {
    s0: dashboard,
    s3: capsTable,
    s4: () => pausedTable() + judgmentTable(),
    s6: traces,
    s8: () => categories() + example() + contracts(),
    s9: mediaCost,
    s12: regulatory,
    s14: () => reqTable() + gapTable(),
    s15: gates,
    s16: decisions,
    s17: evidenceTable,
    s18: changelog,
    s20: () => reviewControls() + reviews(),
    s21: coverage,
    s22: () => placeFilters() + placeItems("decision"),
    s24: () => placeItems("gaps"),
    s26: () => matrixTable(),
    s27: () => placeItems("experience") + placeItems("actions"),
    s28: () => placeItems("visual"),
    s29: () => placeItems("media"),
    s30: () => placeItems("views") + viewsBlock(),
    s31: () => placeItems("stores"),
    s32: () => stageBlock(),
    s34: downloadBlock,
    s36: visuals,
    s37: correctionsBlock,
    s38: discoverPlan,
    s39: discoverPhases,
    s40: discoverVisual,
  };

  function discoverVisual() {
    const data = D.discoverVisual || {};
    const list = (items) => (items || []).map((line) => `<li>${esc(line)}</li>`).join("");
    const refs = (data.references || []).map((item) => `<article class="phase-note">
      <h4>${esc(item.screenAr || "")}</h4>
      <p>الملف: <code>${esc(item.file || "")}</code> — ${esc(item.pixels || "")}</p>
      <p>البصمة: <code>${esc(item.sha256 || "")}</code></p>
      <p>${esc(item.statusAr || "")}</p>
    </article>`).join("");
    const sources = (data.themeSources || []).map((item) => `<li><code>${esc(item.path || "")}</code> — ${esc(item.roleAr || "")}</li>`).join("");
    const shots = (data.implementationShots || []).map((path) => `<p><a href="${esc(path)}">${esc(path)}</a></p><img src="${esc(path)}" alt="" style="max-width:100%;height:auto">`).join("");
    const comparisons = (data.comparisons || []).map((path) => `<p><a href="${esc(path)}">${esc(path)}</a></p><img src="${esc(path)}" alt="" style="max-width:100%;height:auto">`).join("");
    return `<p><strong>${esc(data.decisionTitleAr || "")}</strong></p>
      <p>${esc(data.decisionAr || "")}</p>
      <p>${esc(data.deviceDeferralAr || "")}</p>
      <p>${esc(data.phaseApprovalAr || "")}</p>
      <p>${esc(data.priorVisualRc1Ar || "")}</p>
      <p>التاريخ: ${esc(data.decisionDate || "")}</p>
      <h3>مصادر الثيم</h3><ul>${sources}</ul>
      <h3>المراجع المفتوحة</h3>${refs}
      <h3>لقطات التنفيذ</h3>${shots}
      <h3>المقارنة</h3>${comparisons}
      <h3>فروق مقصودة لتطبيق الثيم</h3><ul>${list(data.intentionalThemeDeltasAr)}</ul>
      <h3>فروق تنفيذية متبقية</h3><ul>${list(data.remainingAr)}</ul>
      <h3>ما نُفذ</h3><p>${esc(data.implementationAr || "")}</p>
      <p><a href="${esc(data.generatedRegister || "")}">${esc(data.generatedRegister || "")}</a></p>`;
  }

  function renderNav() {
    $("#navList").innerHTML = D.sections
      .map((s) => `<li><a href="#${s.id}"><span aria-hidden="true">${s.icon}</span><span>${s.num}. ${esc(s.title)}</span></a></li>`)
      .join("");
    const meta = $("#studyMeta");
    if (meta) meta.textContent = D.project.studyVersion + " — " + D.project.studyStatus;
  }

  function renderSections() {
    $("#content").innerHTML = D.sections
      .map((s) => `<section class="section" id="${s.id}"><h2><span aria-hidden="true">${s.icon}</span>${esc(s.num)}. ${esc(s.title)}</h2>${blocks(s.id)}${(extras[s.id] ? extras[s.id]() : "")}</section>`)
      .join("");
  }

  function applyReviewFilters() {
    const st = $("#fStatus") ? $("#fStatus").value : "";
    const sev = $("#fSev") ? $("#fSev").value : "";
    const unit = $("#fUnit") ? $("#fUnit").value : "";
    const type = $("#fType") ? $("#fType").value : "";
    $$(".review-item").forEach((el) => {
      const ok = (!st || el.dataset.status === st) && (!sev || el.dataset.sev === sev) && (!unit || el.dataset.unit === unit) && (!type || el.dataset.etype === type);
      el.classList.toggle("hidden", !ok);
    });
  }

  function applyPlaceFilters() {
    const st = $("#pStatus") ? $("#pStatus").value : "";
    const domain = $("#pDomain") ? $("#pDomain").value : "";
    $$(".place-item").forEach((el) => {
      const ok = (!st || el.dataset.status === st) && (!domain || el.dataset.domain === domain);
      el.classList.toggle("hidden", !ok);
    });
  }

  function resetReviewFilters() {
    ["fStatus", "fSev", "fUnit", "fType"].forEach((id) => {
      const el = $("#" + id);
      if (el) el.value = "";
    });
    applyReviewFilters();
  }

  function applySearch(q) {
    const query = q.trim().toLowerCase();
    $$(".section").forEach((sec) => {
      const hit = !query || sec.textContent.toLowerCase().includes(query);
      sec.classList.toggle("hidden", !hit);
      sec.querySelectorAll("details").forEach((det) => {
        if (query && det.textContent.toLowerCase().includes(query)) det.open = true;
      });
    });
  }

  function reveal(id) {
    const search = $("#studySearch");
    if (search) {
      search.value = "";
      applySearch("");
    }
    resetReviewFilters();
    const el = document.getElementById(id);
    if (!el) return;
    const det = el.closest("details");
    if (det) det.open = true;
    if (el.tagName === "DETAILS") el.open = true;
    const sec = el.closest(".section");
    if (sec) sec.classList.remove("hidden");
    el.scrollIntoView({ block: "start" });
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(D, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mira-commerce-study-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportCSV() {
    const lines = ["kind,id,status,title"];
    D.reviewFindings.forEach((r) => lines.push(["review", r.id, r.status, r.titleAr].map((x) => `"${String(x).replaceAll('"', '""')}"`).join(",")));
    D.capabilities.forEach((c) => lines.push(["capability", c.id, c.activation, c.nameAr].map((x) => `"${String(x).replaceAll('"', '""')}"`).join(",")));
    D.scopeCoverage.forEach((s) => lines.push(["scope", s.id, s.status, s.titleAr].map((x) => `"${String(x).replaceAll('"', '""')}"`).join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mira-commerce-study-export.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function init() {
    renderNav();
    renderSections();
    $("#btnExportJson").addEventListener("click", exportJSON);
    $("#btnExportCsv").addEventListener("click", exportCSV);
    $("#btnPrint").addEventListener("click", () => window.print());
    $("#studySearch").addEventListener("input", (e) => applySearch(e.target.value));
    document.body.addEventListener("click", (e) => {
      const copy = e.target.closest("[data-copy]");
      if (copy) {
        e.preventDefault();
        copyText(copy.getAttribute("data-copy"));
        return;
      }
      const link = e.target.closest("[data-copy-link]");
      if (link) {
        e.preventDefault();
        copyText(linkHref(link.getAttribute("data-copy-link")));
      }
    });
    document.body.addEventListener("change", (e) => {
      if (e.target.closest("#reviewFilters")) applyReviewFilters();
      if (e.target.closest("#placeFilters")) applyPlaceFilters();
    });
    const resetPlaces = $("#resetPlaces");
    if (resetPlaces) resetPlaces.addEventListener("click", () => {
      ["pStatus", "pDomain"].forEach((id) => {
        const el = $("#" + id);
        if (el) el.value = "";
      });
      applyPlaceFilters();
    });
    const reset = $("#resetReview");
    if (reset) reset.addEventListener("click", () => {
      resetReviewFilters();
      const search = $("#studySearch");
      if (search) {
        search.value = "";
        applySearch("");
      }
    });
    $$("th").forEach((th) => {
      th.addEventListener("click", () => sortTable(th));
      th.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          sortTable(th);
        }
      });
    });
    window.addEventListener("hashchange", () => {
      if (location.hash) reveal(decodeURIComponent(location.hash.slice(1)));
    });
    if (location.hash) reveal(decodeURIComponent(location.hash.slice(1)));
    document.body.addEventListener("click", (e) => {
      const opener = e.target.closest(".open-image");
      if (!opener) return;
      const box = $("#imageLightbox");
      const img = $("#lightboxImage");
      const cap = $("#lightboxCaption");
      if (!box || !img) return;
      img.src = opener.getAttribute("data-full");
      img.alt = opener.getAttribute("data-caption") || "";
      if (cap) cap.textContent = opener.getAttribute("data-caption") || "";
      if (typeof box.showModal === "function") box.showModal();
    });
    const closeBox = $("#closeLightbox");
    if (closeBox) closeBox.addEventListener("click", () => {
      const box = $("#imageLightbox");
      if (box && box.open) box.close();
    });
  }

  function sortTable(th) {
    const tableEl = th.closest("table");
    const idx = Array.from(th.parentNode.children).indexOf(th);
    const body = tableEl.querySelector("tbody");
    const rows = Array.from(body.rows);
    const dir = th.dataset.dir === "asc" ? "desc" : "asc";
    th.dataset.dir = dir;
    rows.sort((a, b) => {
      const av = a.cells[idx].textContent.trim();
      const bv = b.cells[idx].textContent.trim();
      return dir === "asc" ? av.localeCompare(bv, "ar") : bv.localeCompare(av, "ar");
    });
    rows.forEach((r) => body.appendChild(r));
  }

  init();
})();
