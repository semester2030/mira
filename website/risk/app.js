(function () {
  const study = window.MIRA_STUDY;
  const fu = window.MiraFollowup;
  const counts = window.MiraCounts;
  const KEY = fu.STORAGE_KEY;
  const storage = {
    get: () => localStorage.getItem(KEY),
    set: (value) => localStorage.setItem(KEY, value),
    remove: () => localStorage.removeItem(KEY)
  };
  const riskIds = study.risks.map((r) => r.id);
  const session = fu.openSession(storage, riskIds, study.meta.baselineVersion);
  let follow = session.state.follow;
  let quarantine = null;
  let view = "home";
  let flash = "";
  let pending = null;
  const booted = session.load();
  follow = session.state.follow;
  quarantine = session.state.quarantine;
  if (!booted.ok) flash = booted.messageAr + " البيانات الأصلية ما زالت في المتصفح ويمكن تصديرها. لم تُستبدل بمتابعة فارغة.";
  let filters = { q: "", priority: "", type: "", status: "", sort: "id", layout: "table" };

  function syncSession() {
    follow = session.state.follow;
    quarantine = session.state.quarantine;
  }

  function dialogueHomeCard() {
    const dialogue = window.MIRA_CONSULT_DIALOGUE;
    if (!dialogue || !Array.isArray(dialogue.tasks)) return "";
    const verified = dialogue.tasks.filter((task) => task.state === "verified_local" || task.state === "verified_model").length;
    const release = dialogue.release || {};
    const gate = release.published ? `<p>نُشر · اختُبر تقنيًا · بانتظار اختبار المالك النهائي</p>` : "";
    return `<a class="card" id="dialogue-home-card" href="consult-dialogue.html"><p class="num">${verified}/${dialogue.tasks.length}</p><p>محادثة الجمال والصور: مهام تحققت تقنيًا من المسجّل</p>${gate}<p>آخر تحديث ${esc(dialogue.updatedAt)}</p></a>`;
  }

  function esc(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function evidenceById(id) {
    return (study.evidence || []).find((e) => e.id === id) || (study.legalNotes || []).find((e) => e.id === id);
  }

  function setView(next) {
    view = next;
    if (location.hash !== "#" + next) history.replaceState(null, "", "#" + next);
    render();
    const main = document.getElementById("app");
    if (main) main.focus();
  }

  let rendering = false;
  function render() {
    if (rendering) return;
    rendering = true;
    try {
    document.getElementById("approval").textContent = (study.meta.remediationVersion || "") + " — " + study.meta.approvalLabelAr;
    document.querySelectorAll(".nav button").forEach((button) => {
      if (button.dataset.view === view) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const html = {
      home: viewHome,
      coverage: viewCoverage,
      risks: viewRisks,
      skin: viewSkin,
      consult: viewConsult,
      outfit: viewOutfit,
      controls: viewControls,
      legal: viewLegal,
      gaps: viewGaps,
      plan: viewPlan,
      follow: viewFollow,
      rc4: viewRc4,
      batch1rc4: viewBatch1Rc4,
      rc5: viewRc5,
      batch1rc5: viewBatch1Rc5,
      batch2: viewBatch2,
      batch2rc2: viewBatch2Rc2,
      batch2rc3: viewBatch2Rc3,
      batch3: viewBatch3,
      batch4: viewBatch4,
      batch1: viewBatch1,
      rc2: viewRc2,
      rc3: viewRc3,
      print: viewPrint
    }[view] || viewHome;
    document.getElementById("app").innerHTML = (flash ? `<p class="flash">${esc(flash)}</p>` : "") + html();
    flash = "";
    bind();
    } finally { rendering = false; }
  }

  function viewHome() {
    const c = counts.summarize(study, follow);
    return `<section>
      <article class="panel" id="shown-version">
        <h2>الإصدار المعروض: ${esc(study.meta.remediationVersion || "")}</h2>
        <p>آخر تحديث <bdi>${esc(study.meta.remediationUpdatedAt || "")}</bdi> بتوقيت الرياض.</p>
        <p>إصدار الدراسة الأساسي ${esc(study.meta.version)}. ${esc(study.meta.studyBaselineAr || "")}</p>
        <p>معرّف البناء <bdi>${esc(study.meta.baselineVersion || "")}</bdi>.</p>
        <p>${esc(study.meta.openItemsRc3NoteAr || "")}</p>
        <p>008 مقاومة التلاعب: الحالات السابقة لم تنتج تنفيذًا ولا وصولًا إلى حساب آخر. 012 جودة الإجابات: سؤال الإعلان وسؤال الترطيب في هذه الجولة لهما مدخل ومخرج وحكم منفصل عن نجاح الحماية.</p>
        <p>010: أقدم لحظة استرداد مقروءة 2026-10-04T11:36:09Z في قراءة 11 أكتوبر 2026. اسم خطة مساحة العمل غير موجود في واجهة المالك، ولم تُنفَّذ استعادة. 015: جدول في قاعدة الاختبار الموجودة. الخدمة المنشورة لم تُحدَّث.</p>
        <p>سجل سابق: ${esc(study.meta.openItemsRc2NoteAr || "")}</p>
        <p>مؤجلة بقرار المالك: 004 و005 و013. استدعاءات هذه الجولة: 2، وحد الإخراج 800، ومن دون إعادة محاولة. سجل المحاولات الـ17 السابقة مستقل.</p>
        <p>مؤجلة بقرار المالك: 004 و005 و013. التأجيل ليس إصلاحًا.</p>
        <p><button type="button" data-view="batch4">تفاصيل هذه الدفعة</button></p>
      </article>
      <p class="note">إصلاح ملاحظات الموقع في RC5 مكتمل ضمن هذه الحزمة. العدادات التالية تحصي المخاطر، وعددها ${c.total}. منها ${c.reproduced} نتيجتها التقنية PASS، و${c.acceptanceNotMet} معيار قبولها لم يجتز، و${c.notTested} معيار قبولها لم يُختبر. حالات الاستشارة ${c.caseTotal}: ${c.caseAcceptanceNotMet} لم يجتز قبولها، و${c.caseAcceptanceNotTested} لم يُختبر قبولها. اعتماد المالك: ${esc(study.meta.approvalLabelAr)}. إغلاق ملاحظات المرجع لا يغلق مخاطر التطبيق.</p>
      <div class="cards">
        <article class="card"><p class="num">${c.settledSource}</p><p>مخاطر: سلوك مصدر محسوم الاتجاه</p></article>
        <article class="card"><p class="num">${c.unsettled}</p><p>مخاطر: تناقض مصدر غير محسوم</p></article>
        <article class="card"><p class="num">${c.reproduced}</p><p>مخاطر: الاختبار التقني حقق توقعه</p></article>
        <article class="card"><p class="num">${c.acceptanceNotMet}</p><p>مخاطر: معيار القبول لم يجتز</p></article>
        <article class="card"><p class="num">${c.notTested}</p><p>مخاطر: معيار القبول لم يُختبر</p></article>
        <article class="card"><p class="num">${c.partial}</p><p>مخاطر: تحقق جزئي</p></article>
        <article class="card"><p class="num">${c.potential}</p><p>خطر محتمل</p></article>
        <article class="card"><p class="num">${c.gaps}</p><p>فجوة تحقق</p></article>
        <article class="card"><p class="num">${c.open}</p><p>متابعة مفتوحة</p></article>
        ${dialogueHomeCard()}
      </div>
      <article class="panel"><h2>النسخة</h2>
        <p>المستودع ${esc(study.meta.repo)}، الفرع ${esc(study.meta.branch)}.</p>
        <p>الالتزام ${esc(study.meta.commit)} بتاريخ ${esc(study.meta.commitDate)}.</p>
        <p>${esc(study.meta.codeNoteAr)}</p>
        <p>${esc(study.meta.workingTreeAr)}</p>
        <p>${esc(study.meta.rc3NoteAr || "")}</p>
        <p>${esc(study.meta.rc4NoteAr || "")}</p>
        <p>${esc(study.meta.rc5BatchNoteAr || "")}</p>
        <p>${esc(study.meta.batch2NoteAr || "")}</p>
        <p>${esc(study.meta.batch2Rc2NoteAr || "")}</p>
        <p>${esc(study.meta.batch2Rc3NoteAr || "")}</p>
        <p>${esc(study.meta.batch3NoteAr || "")}</p>
        <p>${esc(study.meta.batch4NoteAr || "")}</p>
        <p>${esc(study.meta.productionAr)}</p>
        <p>تاريخ التدقيق ${esc(study.meta.auditDate)} بتوقيت ${esc(study.meta.timezone)}.</p>
        <p>آخر فحص حداثة مضمّن: ${esc(study.freshness.ranAt)}. ${esc(study.freshness.noteAr)}</p>
        <p>${esc(study.meta.roleAr)}</p>
      </article>
    </section>`;
  }

  function viewCoverage() {
    const rows = study.features.map((f) => `<tr><td>${esc(f.nameAr)}</td><td>${esc(f.statusAr)}</td><td>${esc(f.pathAr)}</td><td>${esc(f.checkedAr || "")}</td><td>${esc(f.notCheckedAr || "")}</td><td>${esc(f.decisionAr)}</td><td>${(f.topRisks || []).map((id) => `<button type="button" data-open="${esc(id)}">${esc(id)}</button>`).join(" ") || "لا سجل — ليست سلامة"}</td></tr>`).join("");
    return `<section><h2>مصفوفة التغطية</h2><table><thead><tr><th>الميزة</th><th>الحالة</th><th>المسار</th><th>ما فُحص</th><th>ما لم يُفحص</th><th>القرار</th><th>السجلات</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }

  function selectedRisks() {
    const q = filters.q.trim();
    let rows = study.risks.filter((r) => {
      const status = counts.statusOf(r, follow);
      const blob = `${r.id} ${r.titleAr} ${r.scenarioAr}`;
      if (q && !blob.includes(q)) return false;
      if (filters.priority && r.priority !== filters.priority) return false;
      if (filters.type && r.recordType !== filters.type) return false;
      if (filters.status && status !== filters.status) return false;
      return true;
    });
    rows.sort((a, b) => filters.sort === "priority" ? a.priority.localeCompare(b.priority) : a.id.localeCompare(b.id));
    return rows;
  }

  function viewRisks() {
    const rows = selectedRisks();
    const body = rows.map(riskRow).join("");
    return `<section><h2>السجل</h2>
      <div class="filters">
        <input id="q" placeholder="بحث" value="${esc(filters.q)}">
        <select id="priority"><option value="">كل الأولويات</option>${["P0","P1","P2","P3"].map((p) => `<option ${filters.priority===p?"selected":""}>${p}</option>`).join("")}</select>
        <select id="type"><option value="">كل الأنواع</option>
          <option value="proven_issue" ${filters.type==="proven_issue"?"selected":""}>مشكلة أو تناقض</option>
          <option value="potential_risk" ${filters.type==="potential_risk"?"selected":""}>محتمل</option>
          <option value="verification_gap" ${filters.type==="verification_gap"?"selected":""}>فجوة</option>
        </select>
        <select id="status"><option value="">كل المتابعة</option>${fu.STATUSES.map((s) => `<option ${filters.status===s?"selected":""}>${s}</option>`).join("")}</select>
        <select id="sort"><option value="id">فرز بالمعرف</option><option value="priority" ${filters.sort==="priority"?"selected":""}>فرز بالأولوية</option></select>
        <select id="layout"><option value="table">جدول</option><option value="cards" ${filters.layout==="cards"?"selected":""}>بطاقات</option></select>
        <button type="button" id="csv">تصدير CSV للمعروض</button>
      </div>
      <p id="risk-count">${rows.length} من ${study.risks.length}</p>
      <p class="note">الحكم الحالي هو الاختبار التقني ومعيار القبول. localTest حقل قديم للتوافق وليس مرجع الحكم. تصدير CSV يستخدم رموز المصدر نفسها.</p>
      ${filters.layout === "cards"
        ? `<div class="cards">${rows.map(riskCard).join("")}</div>`
        : `<table><thead><tr><th>المعرف</th><th>العنوان</th><th>الأولوية</th><th>النوع</th><th>المتابعة</th><th>الاختبار التقني</th><th>معيار القبول</th><th>الدلالة</th><th>الاختبارات</th></tr></thead><tbody>${body}</tbody></table>`}
      <div id="detail"></div></section>`;
  }

  function meaningLabel(value) {
    if (value === "proved_defect") return "أثبت مشكلة";
    if (value === "proved_correct") return "أثبت سلوكًا صحيحًا";
    if (value === "partial") return "تحقق جزئي";
    return "لم يُختبر";
  }

  function technicalLabel(value) {
    if (value === "PASS") return "نجح تشخيصيًا";
    if (value === "FAIL") return "لم يحقق التوقع";
    if (value === "SOURCE_ONLY") return "قراءة مصدر";
    if (value === "BLOCKED") return "تعذر";
    return "لم يُنفذ";
  }

  function acceptanceLabel(value) {
    if (value === "MET") return "اجتاز";
    if (value === "NOT_MET") return "لم يجتز";
    if (value === "BLOCKED") return "تعذر التحقق";
    return "لم يُختبر";
  }

  function scopeLabel(value) {
    if (value === "original_function_stub") return "دالة أصلية بمزود وهمي";
    if (value === "source") return "قراءة مصدر";
    if (value === "full_path") return "مسار كامل";
    if (value === "device") return "جهاز";
    return "لم يُختبر";
  }

  function shown(value, label) {
    return `${label(value)} (${value || "—"})`;
  }

  function riskTests(r) {
    return (r.testIds || []).map((id) => `<button type="button" data-test="${esc(id)}">${esc(id)}</button>`).join(" ") || "لا اختبار مرتبط";
  }

  function riskRow(r) {
    return `<tr><td><button type="button" data-open="${esc(r.id)}">${esc(r.id)}</button></td><td>${esc(r.titleAr)}</td><td>${esc(r.priority)}</td><td>${esc(labelType(r))}</td><td>${esc(counts.statusOf(r, follow))}</td><td>${esc(shown(r.technicalResult || "NOT_RUN", technicalLabel))}</td><td>${esc(shown(r.acceptanceResult || "NOT_TESTED", acceptanceLabel))}</td><td>${esc(shown(r.resultMeaning || "", meaningLabel))}</td><td>${riskTests(r)}</td></tr>`;
  }

  function currentBlock(r) {
    const current = r.currentState;
    if (!current) return "";
    const links = (current.evidence || []).map((link) => `<a href="${esc(link.href)}">${esc(link.labelAr)}</a>`).join(" ");
    return `<section class="panel"><h3>الحالة الحالية ${esc(current.version || "")}</h3><p>قبل المعالجة: ${esc(current.beforeAr)}</p><p>الحالة الآن: ${esc(current.nowAr)}</p><p>ما أُصلح: ${esc(current.fixedAr)}</p><p>معيار القبول ونتيجته: ${esc(current.acceptanceAr)}</p><p>نوع الاختبار وحدوده: ${esc(current.testTypeAr)}</p><p>المتبقي: ${esc(current.remainingAr)}</p><p>آخر تحقق: ${esc(current.verifiedAt)} — ${esc(current.version)}</p><p>${links}</p></section>`;
  }

  function riskCard(r) {
    return `<article class="card"><button type="button" data-open="${esc(r.id)}">${esc(r.id)}</button><p>${esc(r.titleAr)}</p>${r.currentState ? `<p>الحالة الحالية: ${esc(r.currentState.nowAr)}</p>` : ""}<p>${esc(r.priority)} — ${esc(labelType(r))} — ${esc(counts.statusOf(r, follow))}</p><p>الاختبار التقني: ${esc(shown(r.technicalResult || "NOT_RUN", technicalLabel))}</p><p>معيار القبول: ${esc(shown(r.acceptanceResult || "NOT_TESTED", acceptanceLabel))}</p><p>الدلالة: ${esc(shown(r.resultMeaning || "", meaningLabel))}</p><p>${riskTests(r)}</p></article>`;
  }

  function labelType(r) {
    if (r.recordType === "proven_issue" && !r.settled) return "تناقض مصدر غير محسوم";
    if (r.recordType === "proven_issue") return "سلوك مصدر";
    if (r.recordType === "potential_risk") return "محتمل";
    if (r.recordType === "verification_gap") return "فجوة تحقق";
    return r.recordType;
  }

  function openDetail(id) {
    const r = study.risks.find((item) => item.id === id);
    const box = document.getElementById("detail");
    if (!r || !box) return;
    const item = follow.items[id] || {};
    const evidence = (r.evidenceIds || []).map((eid) => {
      const ev = evidenceById(eid);
      if (!ev) return `<p>دليل غير موجود: ${esc(eid)}</p>`;
      if (ev.excerpt) return `<article class="panel"><h3>${esc(ev.id)} — ${esc(ev.file)}:${esc(ev.lines)}</h3><p>${esc(ev.provesAr)}</p><p>${esc(ev.limitsAr)}</p><p>البصمة ${esc(ev.sha256)}</p><pre>${esc(ev.excerpt)}</pre></article>`;
      return `<article class="panel"><h3>${esc(ev.id)}</h3><p>${esc(ev.excerptAr || ev.topicAr)}</p><p>${esc(ev.url || "")} — اطلاع ${esc(ev.accessed || "")}</p></article>`;
    }).join("");
    box.innerHTML = `<article class="risk" id="detail-card">
      <h2 id="detail-title" tabindex="-1">${esc(r.id)} — ${esc(r.titleAr)}</h2>
      ${currentBlock(r)}
      <p>النوع: ${esc(labelType(r))} — المصدر: ${esc(r.sourceCheck)} — اختبار أصلي: ${esc(r.originalTest || "NOT_RUN")} — تشغيل: ${esc(r.runtimeCheck)} — جهاز: ${esc(r.deviceCheck)}</p>
      <p>الوصف التاريخي: ${esc(r.scenarioAr)}</p>
      <p>المتضرر: ${esc(r.affectedAr)}</p>
      <p>أدلة مقابلة: ${esc(r.counterEvidenceAr || "")}</p>
      <p>الشدة: ${esc(r.severityAr)} الاحتمال: ${esc(r.likelihoodAr)} الأولوية: ${esc(r.priority)} — ${esc(r.actionAr || "")}</p>
      <p>الحد الأدنى: ${esc(r.minimumFixAr)}</p>
      <p>البديل الأخف: ${esc(r.lighterAltAr)}</p>
      <p>الجهد: ${esc(r.effortAr)} القبول: ${esc(r.acceptanceAr)} إعادة التحقق: ${esc(r.recheckAr || "")}</p>
      <p>المسؤول: ${esc(item.reviewer || r.owner)} — المتابعة: ${esc(counts.statusOf(r, follow))}</p>
      <p>تغيّر عن RC1: ${esc(r.rc1ChangeAr)} ${esc(r.rc2ChangeAr || "")} ${esc(r.rc3ChangeAr || "")} ${esc(r.rc4ChangeAr || "")} ${esc(r.batch1Rc5ChangeAr || "")}</p>
      <p>${esc(r.independentReviewAr || "")} ${esc(r.batch2ChangeAr || "")} ${esc(r.batch2Rc2ChangeAr || "")} ${esc(r.batch2Rc3ChangeAr || "")} ${esc(r.batch3ChangeAr || "")} ${esc(r.batch4ChangeAr || "")} ${esc(r.deferralAr || "")}</p>
      ${r.batch1ChangeAr ? `<p>الدفعة الأولى: ${esc(r.batch1ChangeAr)}</p>` : ""}
      <p>الاختبار التقني: ${esc(shown(r.technicalResult || "NOT_RUN", technicalLabel))} — معيار القبول: ${esc(shown(r.acceptanceResult || "NOT_TESTED", acceptanceLabel))} — الدلالة: ${esc(shown(r.resultMeaning || "", meaningLabel))} — النطاق: ${esc(shown(r.verificationScope || "", scopeLabel))}</p>
      <p>localTest حقل قديم: ${esc(r.localTest || "")}. ليس مرجع الحكم الحالي.</p>
      <p>اختبارات: ${(r.testIds || []).map((id) => `<button type="button" data-test="${esc(id)}">${esc(id)}</button>`).join(" ") || "لا اختبار أصلي مرتبط"}</p>
      <p>سجل المتابعة: ${historyText(item.history)} ${item.historyTrimmed ? "— حُذف من بداية السجل " + item.historyTrimmed : ""}</p>
      ${evidence}
      <form id="save-form" class="noprint">
        <label>الحالة <select name="status">${fu.STATUSES.map((s) => `<option ${((counts.statusOf(r, follow))===s)?"selected":""}>${s}</option>`).join("")}</select></label>
        <label>ملاحظة <textarea name="note">${esc(item.note || "")}</textarea></label>
        <label>وصف المعالجة <textarea name="remediation">${esc(item.remediation || "")}</textarea></label>
        <label>مرجع الدليل <input name="evidenceRef" value="${esc(item.evidenceRef || "")}"></label>
        <label>إعادة الاختبار <select name="retestResult">${fu.RETEST.map((s) => `<option ${((item.retestResult||"NOT_RUN")===s)?"selected":""}>${s}</option>`).join("")}</select></label>
        <label>وصف الإعادة <textarea name="retestNote">${esc(item.retestNote || "")}</textarea></label>
        <label>نسخة الكود أو البيئة <input name="codeVersion" value="${esc(item.codeVersion || "")}"></label>
        <label>اسم المراجع <input name="reviewer" value="${esc(item.reviewer || "")}"></label>
        <label>تاريخ المراجعة <input name="reviewedAt" value="${esc(item.reviewedAt || "")}"></label>
        <button type="submit">حفظ المتابعة</button>
      </form>
    </article>`;
    document.querySelectorAll("#detail [data-test]").forEach((button) => button.addEventListener("click", () => openTest(button.dataset.test)));
    document.getElementById("detail-title").focus();
    document.getElementById("save-form").addEventListener("submit", (event) => {
      event.preventDefault();
      saveItem(id, new FormData(event.target));
    });
  }

  function historyText(history) {
    if (!Array.isArray(history) || !history.length) return "لا تغييرات محفوظة.";
    return history.map((row) => `${esc(row.field)}: ${esc(row.from)} ← ${esc(row.to)}`).join(" | ");
  }

  function saveItem(id, form) {
    if (quarantine) {
      flash = fu.REASONS.quarantine;
      render();
      return;
    }
    const current = follow.items[id] || fu.blankItem();
    const checked = fu.applyChange(current, {
      status: String(form.get("status") || "OPEN"),
      note: String(form.get("note") || ""),
      remediation: String(form.get("remediation") || ""),
      evidenceRef: String(form.get("evidenceRef") || ""),
      retestResult: String(form.get("retestResult") || "NOT_RUN"),
      retestNote: String(form.get("retestNote") || ""),
      codeVersion: String(form.get("codeVersion") || ""),
      reviewer: String(form.get("reviewer") || ""),
      reviewedAt: String(form.get("reviewedAt") || "")
    }, new Date().toISOString());
    if (!checked.ok) {
      flash = "لم يُكتب شيء. " + checked.messageAr;
      render();
      openDetail(id);
      return;
    }
    const next = { ...follow, items: { ...follow.items, [id]: checked.value } };
    const saved = fu.commitStore(storage, next);
    if (!saved.ok) {
      flash = "فشلت الكتابة. " + saved.messageAr;
    } else {
      session.state.follow = saved.value;
      syncSession();
      flash = "حُفظت المتابعة على هذا المتصفح. التصدير هو النسخة الاحتياطية.";
    }
    render();
    openDetail(id);
  }

  function blankItem() {
    return { status: "OPEN", name: "", note: "", remediation: "", evidenceRef: "", retestResult: "NOT_RUN", retestNote: "", codeVersion: "", reviewer: "", reviewedAt: "", history: [] };
  }

  function viewSkin() {
    const rows = study.skinMetrics.map((m) => `<tr><td>${esc(m.nameAr)}</td><td>${esc(m.field)}</td><td>${esc(m.rangeAr || "")}</td><td>${esc(m.transform)}</td><td>${m.adviceBeforeAr ? `قبل الإصلاح: ${esc(m.adviceBeforeAr)} — بعد الإصلاح: ${esc(m.advice)}` : esc(m.advice)}</td><td>${esc(m.missing || "")}</td><td>${esc(m.map || "")}</td></tr>`).join("");
    const law = study.legalNotes.find((n) => n.id === "LAW-YOUCAM");
    return `<section><h2>مؤشرات البشرة</h2><p>${esc(law.excerptAr)}</p><p>اطلاع ${esc(law.accessed)} — ${esc(law.url)}</p><p>المزود: ${esc(study.skinMetrics[0].providerAr)}</p><p>${esc(study.meta.rc3SkinAr || "")}</p><p>${esc(study.meta.rc4SkinAr || "")}</p><p>${esc(study.meta.rc5SkinAr || "")}</p><p>${esc(study.meta.batch2SkinAr || "")}</p><p>${esc(study.meta.batch2Rc2SkinAr || "")}</p><p>${esc(study.meta.batch2Rc3SkinAr || "")}</p><p>${esc(study.meta.batch3SkinAr || "")}</p><p>${esc(study.meta.batch4SkinAr || "")}</p><table><thead><tr><th>المؤشر</th><th>الحقل</th><th>النطاق</th><th>التحويل</th><th>النصيحة</th><th>الغياب</th><th>الخريطة</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }

  function viewConsult() {
    const rows = study.consultationCases.map((c) => `<tr id="case-${esc(c.id)}"><td>${esc(c.id)}</td><td>${esc(c.prompt)}</td><td>${esc(shown(c.technicalResult || c.result || "NOT_RUN", technicalLabel))}</td><td>${esc(shown(c.acceptanceResult || "NOT_TESTED", acceptanceLabel))}</td><td>${esc(shown(c.resultMeaning || "", meaningLabel))}</td><td>${esc(c.actualAr || c.reasonAr)}</td></tr>`).join("");
    const paths = (study.consultationPaths || []).map((p) => `<article class="panel"><h3>${esc(p.nameAr)}</h3><p>الدخول: ${esc(p.entryAr)}</p><p>الصلاحية: ${esc(p.authAr)}</p><p>النموذج: ${esc(p.modelAr)}</p><p>العلم: ${esc(p.flagAr)}</p><p>الذاكرة: ${esc(p.cacheAr)}</p><p>الفشل: ${esc(p.failureAr)}</p></article>`).join("");
    const tests = (study.originalTests || []).map((t) => `<article class="panel" id="${esc(t.id)}"><h3>${esc(t.id)} — تقني ${esc(t.technicalResult || t.result)} — قبول ${esc(t.acceptanceResult || "NOT_TESTED")}</h3><p>${esc(meaningLabel(t.resultMeaning))} — ${esc(t.verificationScope || "")}</p>${t.historicalBeforeFix ? `<p>سجل تاريخي لما قبل الإصلاح. ليس نتيجة المعالجة.</p>` : ""}<p>${esc(t.fn)} في ${esc(t.file)}</p><p>المدخل: ${esc(typeof t.input === "string" ? t.input : "")}</p><p>المخرج: ${esc(t.actual == null ? "" : JSON.stringify(t.actual))}</p><p>${esc(t.provesAr)}</p><p>${esc(t.limitsAr)}</p></article>`).join("");
    return `<section><h2>مسارات الاستشارة</h2><p>${esc(study.meta.batch3ConsultAr || "")}</p><p>${esc(study.meta.batch4ConsultAr || "")}</p>${paths}<h2>اختبارات الدوال الأصلية</h2><p>${esc((study.localBehavior || {}).noteAr || "")} ${esc((study.localBehavior || {}).limitsAr || "")}</p>${tests}<h2>حالات التقييم</h2><p>المعايير قبل التشغيل: الالتزام بالسياق، صحة الاستناد، عدم اختراع الحقائق، وضوح العربية، الفائدة، وحدود الخدمة. العينة ${study.consultationCases.length} حالة. النجاح التقني يعني أن التوقع التشخيصي تحقق على الدالة الأصلية، ولا يعني اجتياز معيار القبول.</p><table><thead><tr><th>الحالة</th><th>السؤال</th><th>الاختبار التقني</th><th>معيار القبول</th><th>الدلالة</th><th>الفعلي</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }

  function viewLegal() {
    const rows = study.legalNotes.map((n) => `<article class="panel"><h3>${esc(n.topicAr)} — ${esc(n.classAr)}</h3><p>${esc(n.articleAr || "")}</p><p>${esc(n.excerptAr)}</p><p>${esc(n.appliesAr || "")}</p><p>${esc(n.gapAr)}</p><p>${esc(n.url)} — اطلاع ${esc(n.accessed)}</p></article>`).join("");
    return `<section><h2>ما يتصل بالنشاط في السعودية</h2><p>هذه قراءة مصادر اُطلع عليها، وليست رأيًا نظاميًا ملزمًا.</p>${rows}</section>`;
  }

  function viewOutfit() {
    return `<section><h2>الإطلالة</h2><p>${esc(study.meta.batch3OutfitAr || "")}</p><p>المصدر الحالي كاميرا مباشرة. المطلوب استديو. محتوى الصورة قد يبقى جسمًا حتى في الاستديو. تحليل الجسم ما زال في النموذج. قرار صور العارض غير معتمد. تأجيل المعالجة لا يحذف المسار الحالي.</p><p>معايير الجودة المقترحة: نوع القطعة، اللون الظاهر، عدم اختراع الخامة أو الماركة، ملاءمة المناسبة، والصورة غير الكافية.</p></section>`;
  }

  function viewControls() {
    return `<section><h2>ضوابط موجودة</h2>${study.controls.map((c) => `<article class="panel"><h3>${esc(c.id)} — ${esc(c.titleAr)}</h3><p>${esc(c.noteAr)}</p></article>`).join("")}</section>`;
  }

  function viewGaps() {
    return `<section><h2>لم يُفحص</h2><ul>${study.notExamined.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><h2>سؤال تقني غير محسوم</h2><ul>${(study.technicalQuestions || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul><h2>قرارات المالك المطلوبة</h2><ul>${study.ownerDecisions.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><h2>إغلاق ملاحظات RC2</h2>${(study.rc2Closure || []).map((row) => `<article class="panel"><h3>${esc(row.id)} — ${esc(row.result)}</h3><p>${esc(row.changeAr)}</p><p>${esc(row.testAr)}</p></article>`).join("")}</section>`;
  }

  function viewPlan() {
    return `<section><h2>خطة مقترحة</h2>${study.phases.map((p) => `<article class="panel"><h3>${esc(p.titleAr)}</h3><p>${esc(p.goalAr)}</p><p>${esc(p.tasks.join(" — "))}</p><p>القبول: ${esc(p.acceptanceAr)}</p><p>${esc(p.statusAr)}</p></article>`).join("")}</section>`;
  }

  function viewFollow() {
    const preview = pending ? `<div class="warn"><p>جاهز للتطبيق: ${pending.summary.count} بندًا، الإصدار ${pending.summary.schemaVersion}، قادم من مخطط ${pending.summary.migratedFrom}، ${pending.summary.baselineMatches ? "البصمة مطابقة" : "البصمة مختلفة وستُستبدل المتابعة الظاهرة بعد موافقتك"}.</p><button type="button" id="apply-import">تطبيق الاستيراد</button> <button type="button" id="cancel-import">إلغاء</button></div>` : "";
    const broken = quarantine ? `<div class="warn"><p>تعذرت قراءة المتابعة المحفوظة. النص الأصلي محفوظ ويمكن تصديره. الحفظ الجديد موقف حتى التصدير أو الاستبدال الصريح.</p><button type="button" id="export-quarantine">تصدير النص المتعذر</button></div>` : "";
    return `<section><h2>المتابعة المحلية</h2>
      ${broken}
      <p class="note">التخزين في متصفح هذا الجهاز فقط. لا مزامنة ولا مراجعة مستقلة. تصدير المتابعة هو النسخة الاحتياطية. تسجيل الإغلاق اسم يكتبه المراجع ولا يثبت الهوية ولا صحة الدليل وحده.</p>
      ${preview}
      <p class="noprint"><button type="button" id="export-study">تصدير الدراسة</button> <button type="button" id="export-follow">تصدير المتابعة</button> <label>استيراد متابعة <input id="import-file" type="file" accept="application/json"></label></p>
      <p>آخر فحص حداثة مضمّن ${esc(study.freshness.ranAt)} بالأمر ${esc(study.freshness.command)}.</p>
    </section>`;
  }

  function viewRc4() {
    const rows = (study.rc4Review || []).map((row) => `<article class="panel" id="${esc(row.id)}"><h3>${esc(row.titleAr)}</h3><p>المشكلة: ${esc(row.problemAr)}</p><p>السبب: ${esc(row.causeAr)}</p><p>التعديل: ${esc(row.changeAr)} — ${esc((row.files || []).join("، "))}</p><p>الاختبار: ${esc(row.testAr)}</p><p>المتوقع: ${esc(row.expectedAr)}</p><p>الفعلي: ${esc(row.actualAr)}</p><p>النطاق: ${esc(row.scopeAr)} — النتيجة: ${esc(row.result)}</p><p>تاريخ التحقق: ${esc(row.checkedAt)} — الكود: ${esc(row.codeVersion)}</p><p>المتبقي: ${esc(row.remainingAr || "لا شيء في نطاق الموقع")}</p>${row.rc5NoteAr ? `<p>إحالة RC5: ${esc(row.rc5NoteAr)}</p>` : ""}</article>`).join("");
    return `<section><h2>مراجعة RC4 — معالجة ملاحظات RC3</h2>${rows}</section>`;
  }

  function viewRc5() {
    const rows = (study.rc5Review || []).map((row) => `<article class="panel" id="${esc(row.id)}"><h3>${esc(row.titleAr)}</h3><p>المشكلة: ${esc(row.problemAr)}</p><p>أثر القراءة: ${esc(row.effectAr)}</p><p>الإصلاح: ${esc(row.changeAr)}</p><p>الملفات: ${esc((row.files || []).join("، "))}</p><p>اختبار القبول: ${esc(row.testAr)}</p><p>المتوقع: ${esc(row.expectedAr)}</p><p>الفعلي: ${esc(row.actualAr)}</p><p>التاريخ: ${esc(row.checkedAt)} — الكود: ${esc(row.codeVersion)}</p><p>${(row.links || []).map((link) => link.kind === "file" ? `<a href="${esc(link.href)}">${esc(link.labelAr)}</a>` : `<button type="button" data-${esc(link.kind)}="${esc(link.href)}">${esc(link.labelAr)}</button>`).join(" ")}</p><p>الحالة: ${esc(row.result)} — المتبقي: ${esc(row.remainingAr || "لا شيء في هذا التصحيح")}</p></article>`).join("");
    return `<section><h2>مراجعة RC5 — إغلاق ملاحظات RC4</h2>${rows}</section>`;
  }

  function viewBatch1() {
    const rows = (study.remediationBatch1 || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.riskId)} — ${esc(row.titleAr)}</h3>
      <p>السلوك قبل الإصلاح: ${esc(row.beforeAr)}</p>
      <p>سبب المشكلة: ${esc(row.causeAr)}</p>
      <p>الإصلاح: ${esc(row.fixAr)}</p>
      <p>الملفات والدوال: ${esc(row.filesAr)}</p>
      <p>المدخلات: ${esc(row.inputAr)}</p>
      <p>قبل الإصلاح: ${esc(row.outputBeforeAr)}</p>
      <p>بعد الإصلاح: ${esc(row.outputAfterAr)}</p>
      <p>الاختبارات: ${esc(row.testsAr)} — <a href="${esc(row.logHref)}">${esc(row.logLabelAr)}</a></p>
      <p>البيئة والنطاق: ${esc(row.environmentAr)}</p>
      <p>الالتزام: ${esc(row.commitAr)}</p>
      <p>بصمات الملفات: ${esc(row.hashesAr)}</p>
      <p>حالة التنفيذ: ${esc(row.implementationStatus)} — المراجعة المستقلة: ${esc(row.reviewStatusAr)}</p>
      <p>الحدود: ${esc(row.limitsAr)}</p>
      <p><button type="button" data-open="${esc(row.riskId)}">سجل الخطر</button></p>
    </article>`).join("");
    return `<section><h2>معالجة المخاطر — الدفعة الأولى</h2>${rows}</section>`;
  }

  function viewRc2() {
    const rows = (study.remediationBatch1Rc2 || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.titleAr)}</h3>
      <p>المشكلة المثبتة: ${esc(row.problemAr)}</p>
      <p>مثال إعادة الإنتاج: ${esc(row.exampleAr)}</p>
      <p>السبب: ${esc(row.causeAr)}</p>
      <p>الإصلاح: ${esc(row.fixAr)}</p>
      <p>الملفات والدوال: ${esc(row.filesAr)}</p>
      <p>الاختبارات: ${esc(row.testsAr)}</p>
      <p>المدخلات: ${esc(row.inputAr)}</p>
      <p>النتيجة الفعلية: ${esc(row.outputAr)}</p>
      <p><a href="${esc(row.logHref)}">${esc(row.logLabelAr)}</a></p>
      <p>البيئة: ${esc(row.environmentAr)}</p>
      <p>البصمات: ${esc(row.hashesAr)}</p>
      <p>التنفيذ: ${esc(row.implementationStatus)} — ${esc(row.reviewStatusAr)}</p>
      <p>الحدود: ${esc(row.limitsAr)}</p>
    </article>`).join("");
    return `<section><h2>الدفعة الأولى RC2 — إغلاق ملاحظات المراجعة المستقلة</h2><p>حكم MET في RC1 كان على العينة المحدودة التي كشفت المراجعة عدم كفايتها. الحكم في هذا القسم تاريخي لعينة RC2. المراجعة المستقلة كشفت بعدها حالات إضافية عالجها RC3.</p>${rows}</section>`;
  }

  function viewRc3() {
    const rows = (study.remediationBatch1Rc3 || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.titleAr)}</h3>
      <p>المشكلة وسببها: ${esc(row.problemAr)} ${esc(row.causeAr)}</p>
      <p>مثال الفشل المثبت: ${esc(row.exampleAr)}</p>
      <p>التعديل الفعلي: ${esc(row.fixAr)}</p>
      <p>الملفات والدوال: ${esc(row.filesAr)}</p>
      <p>المدخلات: ${esc(row.inputAr)}</p>
      <p>قبل الإصلاح: ${esc(row.outputBeforeAr)}</p>
      <p>بعد الإصلاح: ${esc(row.outputAfterAr)}</p>
      <p>الاختبارات: ${esc(row.testsAr)} — <a href="${esc(row.logHref)}">${esc(row.logLabelAr)}</a></p>
      <p>البيئة والتاريخ: ${esc(row.environmentAr)}</p>
      <p>إصدار الكود: ${esc(row.commitAr)}</p>
      <p>البصمات: ${esc(row.hashesAr)}</p>
      <p>حدود التحقق والمتبقي: ${esc(row.limitsAr)}</p>
      <p>حالة التنفيذ: ${esc(row.implementationStatus)} — المراجعة: ${esc(row.reviewStatusAr)}</p>
    </article>`).join("");
    return `<section><h2>الدفعة الأولى RC3 — معالجة ملاحظات مراجعة RC2</h2><p>نتائج RC1 وRC2 تبقى نتائج تاريخية لعينة اختباراتهما. المراجعة المستقلة كشفت حالات إضافية فاشلة، والنتيجة أدناه لإصلاحها المحلي. مراجعة RC3 كشفت بعد ذلك خلل السؤال التجاري المباشر وأثر إعادة حساب الروتين.</p>${rows}</section>`;
  }

  function viewBatch1Rc4() {
    const rows = (study.remediationBatch1Rc4 || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.titleAr)}</h3>
      <p>سبب المشكلة: ${esc(row.causeAr)}</p>
      <p>مثال الفشل: ${esc(row.exampleAr)}</p>
      <p>قبل الإصلاح: ${esc(row.outputBeforeAr)}</p>
      <p>بعد الإصلاح: ${esc(row.outputAfterAr)}</p>
      <p>الملفات والدوال: ${esc(row.filesAr)}</p>
      <p>الاختبارات: ${esc(row.testsAr)} — <a href="${esc(row.logHref)}">${esc(row.logLabelAr)}</a></p>
      <p>البيئة والتاريخ: ${esc(row.environmentAr)}</p>
      <p>إصدار الكود: ${esc(row.commitAr)}</p>
      <p>البصمات: ${esc(row.hashesAr)}</p>
      <p>حدود التحقق: ${esc(row.limitsAr)}</p>
      <p>الحالة: ${esc(row.implementationStatus)} — ${esc(row.reviewStatusAr)}</p>
    </article>`).join("");
    return `<section><h2>الدفعة الأولى RC4 — معالجة ملاحظات مراجعة RC3</h2><p>أمثلة RC3 السابقة نجحت في نطاقها. المراجعة اللاحقة كشفت جواب السعر المختصر، وأثرًا جانبيًا لإعادة بناء الروتين من درجات تقديرية. إصلاح الروتين اجتاز المراجعة المحلية في نطاق الحالات المختبرة، وبقي كما هو في RC5.</p>${rows}</section>`;
  }

  function viewBatch1Rc5() {
    const rows = (study.remediationBatch1Rc5 || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.titleAr)}</h3>
      <p>السؤال والرد: ${esc(row.exampleAr)}</p>
      <p>سبب التصنيف: ${esc(row.classificationAr)}</p>
      <p>سبب مرور المبلغ: ${esc(row.leakAr)}</p>
      <p>الإصلاح: ${esc(row.fixAr)}</p>
      <p>قبل الإصلاح: ${esc(row.outputBeforeAr)}</p>
      <p>بعد الإصلاح: ${esc(row.outputAfterAr)}</p>
      <p>الملفات والدوال: ${esc(row.filesAr)}</p>
      <p>الاختبارات: ${esc(row.testsAr)} — <a href="${esc(row.logHref)}">${esc(row.logLabelAr)}</a></p>
      <p>البيئة والتاريخ: ${esc(row.environmentAr)}</p>
      <p>إصدار الكود: ${esc(row.commitAr)}</p>
      <p>حدود التحقق: ${esc(row.limitsAr)}</p>
      <p>الحالة: ${esc(row.implementationStatus)} — ${esc(row.reviewStatusAr)}</p>
    </article>`).join("");
    return `<section><h2>الدفعة الأولى RC5 — تصحيح مسار السؤال التجاري</h2><p>نتائج RC2 وRC3 وRC4 تبقى صحيحة لعيناتها. هذه البطاقة للحالة التي كشفتها مراجعة RC4. إصلاح الروتين لم يُفتح من جديد. المراجعة المستقلة قبلت هذا النطاق المحلي لاحقًا، والاعتماد ما زال مسودة للمالك.</p>${rows}</section>`;
  }

  function viewBatch2() {
    const rows = (study.remediationBatch2 || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.titleAr)}</h3>
      <p>المشكلة أو الفجوة: ${esc(row.problemAr)}</p>
      <p>السبب: ${esc(row.causeAr)}</p>
      <p>قبل الإصلاح: ${esc(row.outputBeforeAr)}</p>
      <p>بعد الإصلاح: ${esc(row.outputAfterAr)}</p>
      <p>الملفات والدوال: ${esc(row.filesAr)}</p>
      <p>الاختبارات: ${esc(row.testsAr)} — <a href="${esc(row.logHref)}">${esc(row.logLabelAr)}</a></p>
      <p>الأدلة: ${esc(row.evidenceAr)}</p>
      <p>نطاق التحقق: ${esc(row.scopeAr)}</p>
      <p>المتبقي: ${esc(row.remainingAr)}</p>
      <p>الحالة: ${esc(row.implementationStatus)} — ${esc(row.reviewStatusAr)}</p>
    </article>`).join("");
    return `<section><h2>الدفعة الثانية — صدق مؤشرات البشرة ووضوحها</h2><p>إصلاحات الدفعة الأولى مقبولة في نطاق الاختبارات المحلية. هذه الجولة لا تعيد فتحها. اعتماد المالك ما زال DRAFT_FOR_OWNER_REVIEW. عينات الدرجات الغائبة هنا نجحت، والملاحظات اللاحقة في قسم RC2.</p>${rows}</section>`;
  }

  function viewBatch2Rc2() {
    const rows = (study.remediationBatch2Rc2 || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.titleAr)}</h3>
      <p>نوع الدليل: ${esc(row.evidenceTypeAr)}</p>
      <p>المدخل: ${esc(row.inputAr)}</p>
      <p>قبل الإصلاح: ${esc(row.outputBeforeAr)}</p>
      <p>بعد الإصلاح: ${esc(row.outputAfterAr)}</p>
      <p>السبب: ${esc(row.causeAr)}</p>
      <p>الملفات والدوال والأسطر والبصمات: ${esc(row.filesAr)}</p>
      <p>الاختبارات: ${esc(row.testsAr)} — <a href="${esc(row.logHref)}">${esc(row.logLabelAr)}</a></p>
      <p>حدود التحقق والمتبقي: ${esc(row.limitsAr)}</p>
    </article>`).join("");
    return `<section><h2>الدفعة الثانية RC2 — التحقق عند قراءة التقرير والمسار المحلي</h2><p>عينات RC1 نجحت ضمن ما اختبرته. المراجعة المستقلة وجدت بعد ذلك درجة غير صالحة تدخل الاستشارة والتقدم، ومسار تقارير محلية لم يُختبر تشغيله هناك. التنفيذ الجديد REPORTED_DONE بانتظار المراجعة المستقلة. الاعتماد DRAFT_FOR_OWNER_REVIEW. الملاحظتان تتبعان MIRA-RISK-002. اختبار الصفر هناك لم يقرأ حقل hydration الغائب من JSON.</p>${rows}</section>`;
  }

  function viewBatch2Rc3() {
    const rows = (study.remediationBatch2Rc3 || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.titleAr)}</h3>
      <p>المشكلة: ${esc(row.problemAr)}</p>
      <p>سلسلة المصدر: ${esc(row.chainAr)}</p>
      <p>الفرق بين الصفر الصريح والحقل الغائب: ${esc(row.differenceAr)}</p>
      <p>المدخل: ${esc(row.inputAr)}</p>
      <p>قبل الإصلاح: ${esc(row.outputBeforeAr)}</p>
      <p>بعد الإصلاح: ${esc(row.outputAfterAr)}</p>
      <p>السبب: ${esc(row.causeAr)}</p>
      <p>الملفات والدوال والأسطر والبصمات: ${esc(row.filesAr)}</p>
      <p>الاختبارات: ${esc(row.testsAr)} — <a href="${esc(row.logHref)}">${esc(row.logLabelAr)}</a></p>
      <p>حدود السجلات القديمة: ${esc(row.limitsAr)}</p>
    </article>`).join("");
    return `<section><h2>الدفعة الثانية RC3 — حفظ غياب الترطيب عند قراءة التقرير</h2><p>معالجة الدرجات غير الصالحة في RC2 نجحت في المراجعة المحلية. الاختبار السابق أثبت الصفر الصريح ولم يشمل غياب الحقل عند قراءة JSON. هذه الجولة تعالج ذلك المسار ضمن MIRA-RISK-002. التنفيذ REPORTED_DONE بانتظار المراجعة المستقلة. الاعتماد DRAFT_FOR_OWNER_REVIEW.</p>${rows}</section>`;
  }

  function viewBatch3() {
    const rows = (study.remediationBatch3 || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.id)} — ${esc(row.riskId)} — ${esc(row.titleAr)}</h3>
      <p>المشكلة: ${esc(row.problemAr)}</p>
      <p>الأثر على المستخدمة: ${esc(row.userImpactAr)}</p>
      <p>ما قُبل سابقًا: ${esc(row.previouslyAcceptedAr)}</p>
      <p>ما تعالجه هذه الدفعة: ${esc(row.thisBatchAr)}</p>
      <p>المدخل: ${esc(row.inputAr)}</p>
      <p>قبل الإصلاح: ${esc(row.outputBeforeAr)}</p>
      <p>بعد الإصلاح: ${esc(row.outputAfterAr)}</p>
      <p>الملفات والرموز والأسطر والبصمات: ${esc(row.filesAr)}</p>
      <p>الاختبارات: ${esc(row.testsAr)} — <a href="${esc(row.logHref)}">${esc(row.logLabelAr)}</a></p>
      <p>البيئة والأوامر: ${esc(row.environmentAr)}</p>
      <p>حدود الإثبات: ${esc(row.limitsAr)}</p>
      <p>النتيجة الفنية ${esc(row.technicalResult)} — معيار القبول ${esc(row.acceptanceResult)} — المتابعة ${esc(row.followStatus)}. ${esc(row.acceptanceMeaningAr)}</p>
    </article>`).join("");
    return `<section><h2>الدفعة الثالثة — المؤشر العام واعتمادية الاستشارة وسياق المحادثة</h2><p>B3MARK</p><p>ثلاث بطاقات مستقلة للبنود 002 و009 و014. التنفيذ REPORTED_DONE بانتظار المراجعة المستقلة. الاعتماد DRAFT_FOR_OWNER_REVIEW. قرار المالك 2026-10-11 أجّل أعمال الصور والإطلالة للبنود 004 و005 و013 بحالة DEFERRED، والتأجيل ليس PASS ولا MET. البند 015 بلا قرار تأجيل خاص.</p>${rows}</section>`;
  }

  function viewBatch4() {
    const rows = (study.remediationBatch4 || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.id)} — ${esc(row.titleAr)}</h3>
      <p>المطلوب: ${esc(row.requiredAr)}</p>
      <p>ما نُفذ: ${esc(row.doneAr)}</p>
      <p>المدخل: ${esc(row.inputAr)}</p>
      <p>المخرج: ${esc(row.outputAr)}</p>
      <p>الاختبارات: ${esc(row.testsAr)}</p>
      <p>الملفات والأسطر والبصمات: ${esc(row.filesAr)}</p>
      <p>بيئة التشغيل: ${esc(row.environmentAr)}</p>
      <p>النتيجة: ${esc(row.resultAr)}</p>
      <p>حدودها: ${esc(row.limitsAr)}</p>
    </article>`).join("");
    const metricRows = (study.skinMetrics || []).map((row) => `<tr>
      <td>${esc(row.nameAr)}</td><td>${esc(row.field)}</td><td>${esc(row.directionAr || "")}</td><td>${esc(row.transform)}</td><td>EV-002 ووثيقة المعاملات 2026-10-11</td><td>${esc(row.usageLimitAr || "")}</td><td>${esc(row.unprovenAr || "")}</td>
    </tr>`).join("");
    const caseRows = (study.consultationRunsB4 || []).map((row) => `<tr data-b4-status="${esc(row.status)}">
      <td>${esc(row.caseId)}</td><td>${esc(row.id)}</td><td>${esc(row.pathAr)}</td><td>${row.liveModel ? "نعم" : "لا"}</td><td>${esc(row.resultAr)} — ${esc(row.reasonAr)}</td><td><a href="${esc(row.evidenceHref)}">${esc(row.evidenceHref)}</a></td><td>${esc(row.status === "DEFERRED" || row.status === "NOT_RUN" ? row.reasonAr : "")}</td>
    </tr>`).join("");
    const live = study.liveConsultationB4 || {};
    const current = (study.remediationBatch4Rc2 || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.id)} — ${esc(row.titleAr)}</h3>
      <p>المشكلة وأثرها: ${esc(row.problemAr)}</p>
      <p>المطلوب: ${esc(row.requiredAr)}</p>
      <p>ما تغير: ${esc(row.changedAr)}</p>
      <p>الملفات والرموز: ${esc(row.filesAr)}</p>
      <p>المدخل: ${esc(row.inputAr)}</p>
      <p>الناتج الفعلي: ${esc(row.outputAr)}</p>
      <p>الأمر والبيئة: ${esc(row.commandAr)}</p>
      <p>النتيجة وحدودها: ${esc(row.resultAr)} ${esc(row.limitsAr)}</p>
    </article>`).join("");
    const rc4 = study.batch4Rc4 || {};
    const rc4Links = (rc4.evidence || []).map((link) => `<a href="${esc(link.href)}">${esc(link.labelAr)}</a>`).join(" ");
    const rc5 = study.batch4Rc5 || {};
    const rc5Cards = (rc5.cards || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.id)} — ${esc(row.titleAr)}</h3>
      <p>المشكلة المثبتة: ${esc(row.problemAr)}</p>
      <p>سببها: ${esc(row.causeAr)}</p>
      <p>التعديل المنفّذ: ${esc(row.changeAr)}</p>
      <p>الملفات والرموز: ${esc(row.filesAr)}</p>
      <p>المدخلات: ${esc(row.inputAr)}</p>
      <p>النتيجة المتوقعة: ${esc(row.expectedAr)}</p>
      <p>النتيجة الفعلية: ${esc(row.actualAr)}</p>
      <p>نوع الاختبار وحدوده: ${esc(row.testTypeAr)} ${esc(row.limitsAr)}</p>
      <p>${(row.evidence || []).map((link) => `<a href="${esc(link.href)}">${esc(link.labelAr)}</a>`).join(" ")}</p>
      <p>الحالة الحالية: ${esc(row.stateAr)}</p>
      <p>المتبقي: ${esc(row.remainingAr)}</p>
    </article>`).join("");
    const open7 = study.open7 || {};
    const open7Cards = (open7.cards || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.id)} — ${esc(row.riskId)} — ${esc(row.titleAr)}</h3>
      <p>المشكلة: ${esc(row.problemAr)}</p>
      <p>الإصلاح: ${esc(row.changeAr)}</p>
      <p>الاختبار: ${esc(row.testAr)}</p>
      <p>النتيجة: ${esc(row.resultAr)}</p>
      <p>نطاق التحقق: ${esc(row.scopeAr || "")}</p>
      <p>${(row.evidence || []).map((link) => `<a href="${esc(link.href)}">${esc(link.labelAr)}</a>`).join(" ")}</p>
      <p>المتبقي: ${esc(row.remainingAr)}</p>
    </article>`).join("");
    const rc2 = study.openItemsRc2 || {};
    const rc2Cards = (rc2.cards || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.id)} — ${esc(row.riskId)} — ${esc(row.titleAr)}</h3>
      <p>التعديل: ${esc(row.changeAr)}</p>
      <p>الاختبار: ${esc(row.testAr)}</p>
      <p>النتيجة: ${esc(row.resultAr)}</p>
      <p>نطاق التحقق: ${esc(row.scopeAr)}</p>
      <p>${(row.evidence || []).map((link) => `<a href="${esc(link.href)}">${esc(link.labelAr)}</a>`).join(" ")}</p>
      <p>المتبقي: ${esc(row.remainingAr)}</p>
    </article>`).join("");
    const openRc3 = study.openItemsRc3 || {};
    const rc3Cards = (openRc3.cards || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.id)} — ${esc(row.riskId)} — ${esc(row.titleAr)}</h3>
      <p>التعديل: ${esc(row.changeAr)}</p>
      <p>الاختبار: ${esc(row.testAr)}</p>
      <p>النتيجة: ${esc(row.resultAr)}</p>
      <p>نطاق التحقق: ${esc(row.scopeAr)}</p>
      <p>${(row.evidence || []).map((link) => `<a href="${esc(link.href)}">${esc(link.labelAr)}</a>`).join(" ")}</p>
      <p>المتبقي: ${esc(row.remainingAr)}</p>
    </article>`).join("");
    const rc3Section = `<article class="panel" id="open-items-rc3">
      <h2>OPEN_ITEMS_RC3 — إكمال الإصلاحات وتسليم النسخة الصحيحة</h2>
      <p>OPEN_ITEMS_RC3</p>
      <p>آخر تحديث <bdi>${esc(study.meta.remediationUpdatedAt || "")}</bdi> بتوقيت الرياض. معرّف البناء <bdi>${esc(study.meta.baselineVersion || "")}</bdi>.</p>
      <p>${esc(openRc3.statusAr || "")}</p>
      ${rc3Cards}
    </article>`;
    const rc2Section = `<article class="panel" id="open-items-rc2">
      <h2>OPEN_ITEMS_RC2 — إكمال المتبقي من البنود المفتوحة</h2>
      <p>OPEN_ITEMS_RC2</p>
      <p>سجل سابق. آخر تحديث لتلك الجولة 2026-10-11T19:25:48+03:00 بتوقيت الرياض.</p>
      <p>${esc(rc2.statusAr || "")}</p>
      ${rc2Cards}
    </article>`;
    const open7Section = `<article class="panel" id="open7">
      <h2>البنود المفتوحة — الإفصاح والحذف والمؤشرات والرحلة والعزل</h2>
      <p>OPEN7_RC1</p>
      <p>آخر تحديث <bdi>${esc(study.meta.remediationUpdatedAt || "")}</bdi> بتوقيت الرياض. معرّف البناء <bdi>${esc(study.meta.baselineVersion || "")}</bdi>.</p>
      <p>${esc(open7.statusAr || "")}</p>
      ${open7Cards}
    </article>`;
    const rc5Section = `<article class="panel" id="batch4-rc5">
      <h2>الدفعة الرابعة RC5 — تصحيح تقييم الإجابات وتاريخ التقرير</h2>
      <p>BATCH4_RC5</p>
      <p>آخر تحديث <bdi>${esc(study.meta.remediationUpdatedAt || "")}</bdi> بتوقيت الرياض. معرّف البناء <bdi>${esc(study.meta.baselineVersion || "")}</bdi>.</p>
      <p>${esc(rc5.statusAr || "")}</p>
      ${rc5Cards}
    </article>`;
    const rc4Section = `<article class="panel" id="batch4-rc4">
      <h2>الدفعة الرابعة RC4 — إكمال التقييم الحي للاستشارات</h2>
      <p>BATCH4_RC4</p>
      <p>سجل سابق. آخر تحديث لتلك الجولة 2026-10-11T17:05:10+03:00 بتوقيت الرياض.</p>
      <p>${esc(rc4.historyLimitAr || "")}</p>
      <p>النقص الذي ثبت في RC3: ${esc(rc4.gapAr || "")}</p>
      <p>ما نُفّذ في المرسِل: ${esc(rc4.implementedAr || "")}</p>
      <p>نتائج الاختبار المحلي للمرسِل: ${esc(rc4.localResultAr || "")}</p>
      <p>حالة التقييم الحي: ${esc(rc4.liveStatusAr || "")}</p>
      <p>الحالات المنفذة: ${esc(rc4.executedAr || "")}</p>
      <p>الحالات غير المنفذة: ${esc(rc4.notRunAr || "")}</p>
      <p>أعداد الاستدعاءات: ${esc(rc4.countsAr || "")}</p>
      <p>نتائج الجودة: ${esc(rc4.qualityAr || "")}</p>
      <p>المتبقي لإقفال الدفعة: ${esc(rc4.remainingAr || "")}</p>
      <p>${rc4Links}</p>
    </article>`;
    const rc3 = (study.remediationBatch4Rc3 || []).map((row) => `<article class="panel" id="${esc(row.id)}">
      <h3>${esc(row.id)} — ${esc(row.titleAr)}</h3>
      <p>المشكلة وأثرها: ${esc(row.problemAr)}</p>
      <p>المطلوب: ${esc(row.requiredAr)}</p>
      <p>ما تغير: ${esc(row.changedAr)}</p>
      <p>الملفات والرموز: ${esc(row.filesAr)}</p>
      <p>المدخل: ${esc(row.inputAr)}</p>
      <p>الناتج الفعلي: ${esc(row.outputAr)}</p>
      <p>الأمر والبيئة: ${esc(row.commandAr)}</p>
      <p>النتيجة وحدودها: ${esc(row.resultAr)} ${esc(row.limitsAr)}</p>
      <p>${(row.evidence || []).map((link) => `<a href="${esc(link.href)}">${esc(link.labelAr)}</a>`).join(" ")}</p>
    </article>`).join("");
    return `<section>${rc3Section}${rc2Section}${open7Section}${rc5Section}${rc4Section}<h2>الدفعة الرابعة — استكمال التقارير المحفوظة والتحقق من جودة الاستشارة</h2><p>OPEN_ITEMS_RC3</p><p>OPEN_ITEMS_RC2</p><p>OPEN7_RC1</p><p>BATCH4_RC5</p><p>BATCH4_RC4</p><p>BATCH4_RC3</p><p>BATCH4_RC2</p><p>B4MARK</p>${rc3}${current}<p>الاعتماد DRAFT_FOR_OWNER_REVIEW. عدد المخاطر 16. البنود 004 و005 و013 تبقى DEFERRED. عداد RC5 التاريخي للاستدعاءات الحية ${esc(String(live.liveModelCalls || 0))}. جودة تلك الجولة السابقة كانت NOT_RUN.</p>${rows}
      <h3>حدود المؤشرات الستة</h3>
      <table><thead><tr><th>المؤشر</th><th>حقل المزود</th><th>معنى الدرجة واتجاهها</th><th>التحويل البرمجي</th><th>مصدر الإثبات</th><th>حدود الاستخدام</th><th>ما بقي غير مثبت</th></tr></thead><tbody>${metricRows}</tbody></table>
      <h3>تقييم الحالات</h3>
      <label>تصفية الحالة <select id="b4-filter"><option value="ALL">الكل</option><option value="EXECUTED">منفذة</option><option value="DEFERRED">مؤجلة</option><option value="NOT_RUN">غير منفذة</option></select></label>
      <table><thead><tr><th>الحالة التاريخية</th><th>تشغيل الدفعة</th><th>المسار</th><th>نموذج حي</th><th>النتيجة وسببها</th><th>الدليل</th><th>التأجيل أو سبب عدم التشغيل</th></tr></thead><tbody>${caseRows}</tbody></table>
      <p>طلب التفويض القديم أُغلق. التقييم الحي نُفّذ في OPEN_ITEMS_RC2: 14 محاولة ثم 3 إعادات بعد إصلاح محلي. النموذج gpt-4o-mini وحد الإخراج 800 ومن دون إعادة محاولة تلقائية.</p>
    </section>`;
  }

  function followPrint() {
    if (quarantine) return "<p>تعذرت قراءة المتابعة المحلية، ولم تُدرج بياناتها.</p>";
    const rows = Object.keys(follow.items);
    if (!rows.length) return "<p>لا بنود متابعة محفوظة في هذا المتصفح.</p>";
    return rows.map((id) => {
      const item = follow.items[id];
      return `<article class="panel"><h3>${esc(id)}</h3><p>الحالة ${esc(item.status)} — إعادة الاختبار ${esc(item.retestResult)}</p><p>ملاحظة: ${esc(item.note)}</p><p>المعالجة: ${esc(item.remediation)}</p><p>الدليل: ${esc(item.evidenceRef)} — الوصف: ${esc(item.retestNote)}</p><p>النسخة ${esc(item.codeVersion)} — المراجع ${esc(item.reviewer)} — التاريخ ${esc(item.reviewedAt)} (${esc(fu.formatRiyadh(item.reviewedAt))})</p><p>السجل: ${historyText(item.history)}</p></article>`;
    }).join("");
  }

  function viewPrint() {
    return `<section><h2>الدراسة كاملة للطباعة</h2><p class="noprint"><button type="button" id="do-print">طباعة كل الأقسام</button></p>
      <p>النسخة ${esc(study.meta.version)} الالتزام ${esc(study.meta.commit)} بتاريخ ${esc(study.meta.commitDate)}. ${esc(study.meta.codeNoteAr)}</p>
      <p>المنهج: حقيقة مصدر، ومسار، وسلوك أُعيد بتشغيل الدالة الأصلية، وأثر لم يُختبر، ومسألة تحتاج تشغيلًا أو مختصًا. PASS هنا يعني أن الاختبار أعاد السلوك الحالي، لا أن الخطر عولج.</p>
      ${viewHome()}${viewCoverage()}${viewSkin()}${viewConsult()}${viewOutfit()}${viewControls()}${viewLegal()}${viewGaps()}${viewPlan()}
      <h2>المخاطر</h2>
      ${study.risks.map((r) => `<article class="risk"><h3>${esc(r.id)} ${esc(r.titleAr)}</h3>${currentBlock(r)}<p>${esc(labelType(r))} / ${esc(r.priority)}</p><p>تقني ${esc(shown(r.technicalResult || "NOT_RUN", technicalLabel))} — قبول ${esc(shown(r.acceptanceResult || "NOT_TESTED", acceptanceLabel))} — ${esc(shown(r.resultMeaning || "", meaningLabel))}</p><p>${esc(r.scenarioAr)}</p><p>${esc(r.counterEvidenceAr || "")}</p><p>${esc(r.minimumFixAr)}</p><p>${esc(r.acceptanceAr)}</p>      <p>تغير: ${esc(r.rc1ChangeAr)} ${esc(r.rc2ChangeAr || "")} ${esc(r.rc3ChangeAr || "")} ${esc(r.rc4ChangeAr || "")} ${esc(r.batch1Rc5ChangeAr || "")} ${esc(r.batch2ChangeAr || "")} ${esc(r.batch2Rc2ChangeAr || "")} ${esc(r.batch2Rc3ChangeAr || "")} ${esc(r.batch3ChangeAr || "")} ${esc(r.batch4ChangeAr || "")} ${esc(r.deferralAr || "")} ${esc(r.rc5ChangeAr || "")} ${esc(r.batch1ChangeAr || "")}</p><p>${esc(r.independentReviewAr || "")}</p></article>`).join("")}
      ${viewBatch1()}
      ${viewRc2()}
      ${viewRc3()}
      ${viewBatch1Rc4()}
      ${viewBatch1Rc5()}
      ${viewBatch2()}
      ${viewBatch2Rc2()}
      ${viewBatch2Rc3()}
      ${viewBatch3()}
      ${viewBatch4()}
      <h2>الأدلة</h2>
      ${(study.evidence || []).map((ev) => `<article class="panel"><h3>${esc(ev.id)} ${esc(ev.file)}:${esc(ev.lines)}</h3><p>${esc(ev.provesAr)}</p><p>${esc(ev.limitsAr)}</p><pre>${esc(ev.excerpt)}</pre></article>`).join("")}
      <h2>اختبارات الدوال الأصلية</h2>
      ${(study.originalTests || []).map((t) => `<article class="panel"><h3>${esc(t.id)} ${esc(t.result)}</h3><p>${esc(t.fn)}</p><p>${esc(t.provesAr)}</p><p>${esc(t.limitsAr)}</p></article>`).join("")}
      <h2>إغلاق ملاحظات RC2</h2>
      ${(study.rc2Closure || []).map((row) => `<p>${esc(row.id)} — ${esc(row.result)} — ${esc(row.changeAr)}</p>`).join("")}
      <h2>حالات الاستشارة ومعيار القبول</h2>
      ${study.consultationCases.map((c) => `<p id="print-${esc(c.id)}">${esc(c.id)} تقني ${esc(shown(c.technicalResult || c.result || "NOT_RUN", technicalLabel))} قبول ${esc(shown(c.acceptanceResult || "NOT_TESTED", acceptanceLabel))} — ${esc(c.actualAr || "")}</p>`).join("")}
      ${viewRc4()}
      ${viewRc5()}
      <h2>المتابعة المحلية</h2>
      ${followPrint()}
    </section>`;
  }

  function exportJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    const rows = selectedRisks().map((r) => counts.resultRow(r, follow));
    const header = Object.keys(rows[0] || counts.resultRow(study.risks[0], follow));
    const lines = [header.join(",")].concat(rows.map((row) => header.map((key) => fu.csvCell(row[key])).join(",")));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mira-risk-rc2-register.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function bind() {
    const q = document.getElementById("q");
    if (q) q.addEventListener("input", () => { filters.q = q.value; paintRows(); });
    ["priority", "type", "status", "sort", "layout"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", () => {
        if (filters[id] === el.value) return;
        filters[id] = el.value;
        paintRows();
      });
    });
    document.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => openRisk(button.dataset.open)));
    document.querySelectorAll("[data-test]").forEach((button) => button.addEventListener("click", () => openTest(button.dataset.test)));
    document.querySelectorAll("[data-case]").forEach((button) => button.addEventListener("click", () => openCase(button.dataset.case)));
    document.querySelectorAll("#app [data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
    const csv = document.getElementById("csv");
    if (csv) csv.addEventListener("click", exportCsv);
    const studyBtn = document.getElementById("export-study");
    if (studyBtn) studyBtn.addEventListener("click", () => exportJson("mira-risk-rc2-study.json", study));
    const followBtn = document.getElementById("export-follow");
    if (followBtn) followBtn.addEventListener("click", () => exportJson("mira-risk-rc2-followup.json", follow));
    const brokenBtn = document.getElementById("export-quarantine");
    if (brokenBtn) brokenBtn.addEventListener("click", () => exportJson("mira-risk-followup-recovery.json", { raw: quarantine }));
    const file = document.getElementById("import-file");
    if (file) file.addEventListener("change", () => readImport(file.files[0]));
    const apply = document.getElementById("apply-import");
    if (apply) apply.addEventListener("click", applyImport);
    const cancel = document.getElementById("cancel-import");
    if (cancel) cancel.addEventListener("click", () => { pending = null; flash = "أُلغي الاستيراد قبل الكتابة."; render(); });
    const print = document.getElementById("do-print");
    if (print) print.addEventListener("click", () => window.print());
    const b4 = document.getElementById("b4-filter");
    if (b4) b4.addEventListener("change", () => {
      document.querySelectorAll("[data-b4-status]").forEach((row) => {
        row.hidden = b4.value !== "ALL" && row.dataset.b4Status !== b4.value;
      });
    });
  }

  function paintRows() {
    if (view !== "risks") return render();
    const count = document.getElementById("risk-count");
    const rows = selectedRisks();
    if (count) count.textContent = `${rows.length} من ${study.risks.length}`;
    const tbody = document.querySelector("tbody");
    if (filters.layout === "cards" || !tbody) return render();
    if (tbody) tbody.innerHTML = rows.map(riskRow).join("");
    document.querySelectorAll("[data-open]").forEach((button) => button.addEventListener("click", () => openRisk(button.dataset.open)));
    document.querySelectorAll("tbody [data-test]").forEach((button) => button.addEventListener("click", () => openTest(button.dataset.test)));
  }

  function readImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed;
      try { parsed = JSON.parse(String(reader.result)); }
      catch (_) { flash = "الملف ليس JSON صالحًا. المتابعة الحالية لم تُكتب."; pending = null; render(); return; }
      const checked = fu.validatePayload(parsed, riskIds, study.meta.baselineVersion);
      if (!checked.ok) { flash = "رُفض الملف قبل أي كتابة. السبب: " + checked.error; pending = null; render(); return; }
      pending = checked;
      flash = "قُرئ الملف ولم يُستبدل شيء بعد.";
      render();
    };
    reader.onerror = () => { flash = "تعذرت القراءة. المتابعة الحالية لم تُكتب."; render(); };
    reader.readAsText(file);
  }

  function applyImport() {
    if (!pending) return;
    const result = session.applyPending(pending.value);
    pending = null;
    syncSession();
    flash = result.ok ? result.messageAr : "فشلت الكتابة. " + result.messageAr;
    render();
  }

  function openRisk(id) {
    if (view !== "risks") {
      view = "risks";
      history.replaceState(null, "", "#risks");
      render();
    }
    openDetail(id);
  }

  function openCase(id) {
    view = "consult";
    history.replaceState(null, "", "#consult");
    render();
    const el = document.getElementById("case-" + id);
    if (!el) return;
    el.setAttribute("tabindex", "-1");
    el.focus();
  }

  function openTest(id) {
    view = "consult";
    history.replaceState(null, "", "#consult");
    render();
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute("tabindex", "-1");
    el.focus();
  }

  document.querySelectorAll(".nav button").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  window.addEventListener("hashchange", () => {
    const next = (location.hash || "#home").slice(1);
    if (next) { view = next; render(); }
  });
  const initial = (location.hash || "#home").slice(1);
  view = initial || "home";
  render();
})();
