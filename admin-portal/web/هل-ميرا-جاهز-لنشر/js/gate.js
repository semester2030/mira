(function () {
  const API_BASE =
    (document.querySelector('meta[name="mira-api-base"]') || {}).content ||
    "https://mira-api-n4p3.onrender.com/api/v1";

  const bootError = document.getElementById("bootError");
  const bootErrorText = document.getElementById("bootErrorText");
  const retryBtn = document.getElementById("retryBtn");
  const appShell = document.getElementById("appShell");
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("backdrop");
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const viewRoot = document.getElementById("viewRoot");

  let ledger = null;

  const titles = {
    home: ["هل ميرا جاهز لنشر", "بطاقة كل منصة ونسبة الجاهزية المثبتة"],
    blockers: ["موانع النشر", "الموانع الإلزامية وما يلزم لإزالتها"],
    journeys: ["رحلات ميرا", "رحلات العميلة وما ثبت منها"],
    requirements: ["متطلبات المتجرين", "Apple وGoogle مربوطان بالمصادر"],
    gaps: ["ما ينقص ميرا", "مقترحات خارج حساب النسبة"],
    clips: ["أداء المقاطع والتفاعل وموقع الخدمات", "سرعة الفيديو · المشاركة · المشاهدات · المسافة"],
    evidence: ["الأدلة وسجل إعادة الاختبار", "الهوية والأدلة وخطوات الإعادة"],
  };

  let clipReport = null;

  function statusBadge(status) {
    const map = {
      "ناجح بدليل": "badge-ok",
      "فشل مثبت": "badge-fail",
      "غير متحقق": "badge-unv",
      "غير منطبق": "badge-warn",
    };
    return `<span class="badge ${map[status] || "badge-unv"}">${escapeHtml(status)}</span>`;
  }

  function verdictBadge(text) {
    const t = String(text || "");
    let cls = "badge-unv";
    if (t.includes("جاهز للإرسال") && !t.includes("غير")) cls = "badge-ok";
    else if (t.includes("لا") || t.includes("غير جاهز")) cls = "badge-fail";
    else if (t.includes("غير محسوم") || t.includes("غير محسومة")) cls = "badge-warn";
    return `<span class="badge ${cls}">${escapeHtml(t)}</span>`;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function adminKey() {
    return localStorage.getItem("mira_admin_key") || "";
  }

  function setAdminKey(key) {
    const v = String(key || "").trim();
    if (v) localStorage.setItem("mira_admin_key", v);
    else localStorage.removeItem("mira_admin_key");
  }

  async function loadLedger() {
    const key = adminKey();
    if (!key) {
      const err = new Error("ADMIN_KEY_REQUIRED");
      err.code = "ADMIN_KEY_REQUIRED";
      throw err;
    }
    // Admin-only: ledger lives behind /admin/store-readiness (X-Admin-Key).
    const apiRes = await fetch(`${API_BASE}/admin/store-readiness`, {
      cache: "no-store",
      headers: { Accept: "application/json", "X-Admin-Key": key },
    });
    if (apiRes.status === 401 || apiRes.status === 403) {
      const err = new Error("ADMIN_KEY_INVALID");
      err.code = "ADMIN_KEY_INVALID";
      throw err;
    }
    if (!apiRes.ok) {
      throw new Error(`تعذّر تحميل السجل من الخادم (${apiRes.status})`);
    }
    const data = await apiRes.json();
    if (!data || !data.siteNameAr) {
      throw new Error("سجل النتائج غير صالح");
    }
    ledger = data;
  }

  function platformCard(key, label) {
    const p = ledger.platforms[key];
    const s = ledger.summaries[key];
    return `
      <article class="card" data-platform="${key}">
        <h3>${label}</h3>
        <div class="pct" role="button" tabindex="0" data-open-checklist="${key}" title="عرض بنود النسبة">
          ${escapeHtml(p.readinessPct)}%
        </div>
        <p class="muted" style="margin:.35rem 0 0">
          جاهزية مثبتة = ${s.provenOk} ÷ ${s.applicable}
          · تغطية ${s.coveragePct}%
          · فشل ${s.failed} · غير متحقق ${s.unverified}
        </p>
        <div class="meta-grid">
          <div class="meta-row"><span>حكم الرفع اليوم</span><b>${verdictBadge(p.uploadVerdict)}</b></div>
          <div class="meta-row"><span>حكم الإرسال للمراجعة</span><b>${verdictBadge(p.submitVerdict)}</b></div>
          <div class="meta-row"><span>أهم مانع</span><b>${escapeHtml(p.topBlocker)}</b></div>
          <div class="meta-row"><span>آخر تحقق</span><b>${escapeHtml(p.lastVerifiedAt)}</b></div>
        </div>
      </article>`;
  }

  function renderHome() {
    const id = ledger.identity;
    return `
      <div class="cards">
        ${platformCard("ios", "iOS · App Store")}
        ${platformCard("android", "Android · Google Play")}
      </div>
      <section class="section card">
        <div class="panel-title">
          <h3 style="margin:0">هوية النسخة المختبرة</h3>
          <span class="muted">${escapeHtml(ledger.auditId)}</span>
        </div>
        <div class="meta-grid">
          <div class="meta-row"><span>المستودع</span><b>${escapeHtml(id.repo)}</b></div>
          <div class="meta-row"><span>الفرع</span><b>${escapeHtml(id.branch)}</b></div>
          <div class="meta-row"><span>Git SHA</span><b>${escapeHtml(id.gitShort)} · ${escapeHtml(id.gitSha)}</b></div>
          <div class="meta-row"><span>الإصدار</span><b>${escapeHtml(id.pubspec)} · ${escapeHtml(id.applicationId)}</b></div>
          <div class="meta-row"><span>API Release</span><b>${escapeHtml(id.releaseServices.api)}</b></div>
          <div class="meta-row"><span>النطاق</span><b>${escapeHtml(ledger.scope)}</b></div>
        </div>
      </section>
      <section class="section card">
        <h3>الجدول النهائي</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المنصة</th>
                <th>نسبة الجاهزية المثبتة</th>
                <th>هل يمكن الرفع اليوم؟</th>
                <th>هل يمكن الإرسال للمراجعة اليوم؟</th>
                <th>أقصر قائمة أعمال متبقية</th>
              </tr>
            </thead>
            <tbody>
              ${(ledger.finalTable || [])
                .map(
                  (r) => `<tr>
                  <td>${escapeHtml(r.platform)}</td>
                  <td><b>${escapeHtml(r.readinessPct)}%</b></td>
                  <td>${verdictBadge(r.canUploadToday)}</td>
                  <td>${verdictBadge(r.canSubmitToday)}</td>
                  <td><ol style="margin:0;padding-inline-start:1.1rem">${(r.shortestRemaining || [])
                    .map((x) => `<li>${escapeHtml(x)}</li>`)
                    .join("")}</ol></td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
      <section class="section card hidden" id="checklistPanel">
        <div class="panel-title">
          <h3 style="margin:0" id="checklistTitle">بنود النسبة</h3>
          <button class="btn btn-ghost" type="button" id="closeChecklist">إغلاق</button>
        </div>
        <div class="table-wrap" id="checklistTable"></div>
      </section>`;
  }

  function checklistTable(platform) {
    const rows = ledger.checklists[platform] || [];
    return `<table>
      <thead><tr><th>المعرّف</th><th>البند</th><th>إلزامي</th><th>الحالة</th><th>الدليل</th><th>ملاحظات</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
            <td>${escapeHtml(r.id)}</td>
            <td>${escapeHtml(r.title)}</td>
            <td>${r.mandatory ? "نعم" : "لا"}</td>
            <td>${statusBadge(r.status)}</td>
            <td>${escapeHtml(r.evidence)}</td>
            <td>${escapeHtml(r.notes)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
  }

  function renderBlockers() {
    return `<div class="list">${(ledger.blockers || [])
      .map(
        (b) => `<article>
        <h4>${escapeHtml(b.title)} ${b.mandatory ? statusBadge("فشل مثبت") : ""}</h4>
        <p><b>المنصة:</b> ${escapeHtml(b.platform)} · <b>المعرّف:</b> ${escapeHtml(b.id)}</p>
        <p><b>الأثر:</b> ${escapeHtml(b.impact)}</p>
        <p><b>الإصلاح:</b> ${escapeHtml(b.fix)}</p>
        <p><b>الدليل:</b> ${escapeHtml((b.evidence || []).join(" · ") || "—")}</p>
      </article>`
      )
      .join("")}</div>`;
  }

  function renderJourneys() {
    return `<div class="list">${(ledger.journeys || [])
      .map(
        (j) => `<article>
        <h4>${escapeHtml(j.title)} ${statusBadge(j.status)}</h4>
        <p><b>${escapeHtml(j.id)}</b> · ${(j.platforms || []).map(escapeHtml).join(" / ")}</p>
        <p><b>الجهاز/السياق:</b> ${escapeHtml(j.device)}</p>
        <p><b>ما نُفّذ:</b> ${(j.stepsTried || []).map(escapeHtml).join(" ← ")}</p>
        <p><b>المتوقع:</b> ${escapeHtml(j.expected)}</p>
        <p><b>الفعلي:</b> ${escapeHtml(typeof j.actual === "string" ? j.actual : JSON.stringify(j.actual))}</p>
        <p><b>ملاحظة الخادم:</b> ${escapeHtml(j.serverNote || "—")}</p>
      </article>`
      )
      .join("")}</div>`;
  }

  function renderRequirements() {
    return `<div class="table-wrap"><table>
      <thead><tr><th>المعرّف</th><th>المنصة</th><th>المتطلب</th><th>المصدر</th><th>الفقرة</th><th>الحالة</th><th>سلوك ميرا</th></tr></thead>
      <tbody>
        ${(ledger.storeRequirements || [])
          .map(
            (r) => `<tr>
            <td>${escapeHtml(r.id)}</td>
            <td>${escapeHtml(r.platform)}</td>
            <td>${escapeHtml(r.title)}<div class="muted">${escapeHtml(r.whyApplies)}</div></td>
            <td><a href="${escapeHtml(r.source)}" target="_blank" rel="noopener">مصدر رسمي</a></td>
            <td>${escapeHtml(r.clause)}</td>
            <td>${statusBadge(r.status)}</td>
            <td>${escapeHtml(r.appBehavior)}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table></div>`;
  }

  function renderGaps() {
    const order = ["مانع إطلاق", "تحسين مهم قبل الإطلاق", "تطوير بعد الإطلاق"];
    const blocks = order
      .map((rank) => {
        const items = (ledger.gaps || []).filter((g) => g.rank === rank);
        if (!items.length) return "";
        return `<section class="section">
          <h3>${escapeHtml(rank)}</h3>
          <div class="list">${items
            .map(
              (g) => `<article>
              <h4>${escapeHtml(g.id)} · ${escapeHtml(g.screen)}</h4>
              <p><b>الخطوة:</b> ${escapeHtml(g.step)}</p>
              <p><b>الملاحظة:</b> ${escapeHtml(g.observed)}</p>
              <p><b>الدليل:</b> ${escapeHtml(g.evidence)}</p>
              <p><b>التغيير المقترح:</b> ${escapeHtml(g.change)}</p>
              <p><b>الأثر:</b> ${escapeHtml(g.impact)} · <b>الجهد:</b> ${escapeHtml(g.effort)}</p>
              <p><b>معيار القبول:</b> ${escapeHtml(g.acceptance)}</p>
            </article>`
            )
            .join("")}</div>
        </section>`;
      })
      .join("");
    const top = `<section class="card section"><h3>أهم خمس أولويات</h3><ol>${(ledger.topPriorities || [])
      .map((t) => `<li><b>${escapeHtml(t.id)}</b> — ${escapeHtml(t.why)}</li>`)
      .join("")}</ol><p class="muted">المقترحات خارج حساب نسبة الجاهزية.</p></section>`;
    return top + blocks;
  }

  function unset(v, fallback) {
    if (v === null || v === undefined || v === "") return fallback || "غير مقيس";
    if (v === false) return "غير مختبر";
    return String(v);
  }

  function renderClips() {
    const r = clipReport || {};
    const n = r.numericAnswers || {};
    const v = r.videoLatency || {};
    const sample = v.deviceSample || {};
    const t = r.testClips || {};
    const media = r.media404 || {};
    const adminGate = r.adminGate || {};
    return `
      <section class="card">
        <h3>${escapeHtml(r.titleAr || "أداء المقاطع والتفاعل وموقع الخدمات")}</h3>
        <p class="muted">${escapeHtml(r.gitSha || "SHA غير محدد")} · ${escapeHtml(r.branch || "")} · ${escapeHtml(r.auditedAtUtc || "")}</p>
        <p class="muted">${escapeHtml((r.environment && r.environment.publishedVsLocal) || "")}</p>
      </section>
      <section class="section card">
        <h3>١) سرعة الفيديو</h3>
        <p><b>المقياس:</b> ${escapeHtml(v.metricAr || "غير مقيس")}</p>
        <p><b>قبل:</b> ${escapeHtml(unset(v.beforeAr, "غير مقيس"))}</p>
        <p><b>بعد:</b> ${escapeHtml(unset(v.afterLocalAr || (sample.medianMs != null ? "وسيط " + sample.medianMs + "ms" : null), "غير مقيس على جهاز"))}</p>
        <p><b>عيّنة الجهاز:</b> n=${escapeHtml(unset(sample.nTransitions, "0"))} · وسيط=${escapeHtml(unset(sample.medianMs))} · P95=${escapeHtml(unset(sample.p95Ms))} · هدف 300/700: ${escapeHtml(sample.meetsTargets === true ? "نعم" : "غير مختبر")}</p>
        <p><b>الملفات:</b> ${(v.files || []).map((f) => `<code>${escapeHtml(f)}</code>`).join(" · ") || "—"}</p>
      </section>
      <section class="section card">
        <h3>٢) الوسائط 404 ومقاطع الاختبار</h3>
        <p>فحص visual: <b>${escapeHtml(unset(media.visualChecked, unset(t.visual1, unset(t.totalFetched))))}</b>
          · ناجح <b>${escapeHtml(unset(media.ok))}</b>
          · فاشل <b>${escapeHtml(unset(media.fail))}</b>
          · مستعاد <b>${escapeHtml(unset(media.restoredBlobs, "0"))}</b></p>
        <p>مقاطع اختبار: visual=${escapeHtml(unset(t.visual1, unset(t.totalFetched)))} · كامل=${escapeHtml(unset(t.fullCatalog))} · محذوف <b>${escapeHtml(unset(t.suspectDeleted, "0"))}</b></p>
        <p>${escapeHtml(t.noteAr || t.scopeNoteAr || t.unresolvedAr || "")}</p>
      </section>
      <section class="section card">
        <h3>٣–٥) مشاركة · مشاهدات · مسافة</h3>
        <p><b>المشاركة:</b> ${escapeHtml(unset((r.share && (r.share.resultAr || r.share.status)), "غير مختبر"))}</p>
        <p><b>المشاهدات:</b> ${escapeHtml(unset((r.views && r.views.policy), "غير مختبر"))} — جدول prod: ${escapeHtml((r.views && r.views.tableOnProd) === true ? "موجود" : "غير موجود / غير منشور")}</p>
        <p><b>المسافة:</b> ${escapeHtml(unset((r.branchDistance && (r.branchDistance.independentVenue || r.branchDistance.status)), "غير مختبر"))}</p>
      </section>
      <section class="section card">
        <h3>بوابة الإدارة</h3>
        <p>${escapeHtml(unset(adminGate.noteAr || adminGate.status, "غير مختبر"))}</p>
      </section>
      <section class="section card">
        <h3>إجابة رقمية مباشرة</h3>
        <div class="meta-grid">
          <div class="meta-row"><span>انتظار الفيديو قبل</span><b>${escapeHtml(unset(n.videoWaitBeforeMs))}</b></div>
          <div class="meta-row"><span>انتظار الفيديو بعد</span><b>${escapeHtml(unset(n.videoWaitAfterMs))}</b></div>
          <div class="meta-row"><span>مقاطع اختبار حُذفت</span><b>${escapeHtml(unset(n.testClipsDeleted, "0"))}</b></div>
          <div class="meta-row"><span>المشاركة</span><b>${escapeHtml(unset(n.shareOk || n.shareOkDevice, "غير مختبر"))}</b></div>
          <div class="meta-row"><span>المشاهدات</span><b>${escapeHtml(unset(n.viewsOk || n.viewsOkDevice, "غير مختبر"))}</b></div>
          <div class="meta-row"><span>المسافة</span><b>${escapeHtml(unset(n.distanceOk || n.distanceOkDevice, "غير مختبر"))}</b></div>
          <div class="meta-row"><span>محلي/منشور</span><b>${escapeHtml(unset(n.localVsPublished, "محلي"))}</b></div>
        </div>
      </section>`;
  }

  function renderEvidence() {
    const media = ledger.mediaProbe || {};
    return `
      <section class="card">
        <h3>إعادة الاختبار</h3>
        <p class="muted">حدّث <code>data/RESULTS_LEDGER.json</code> ثم أعد تحميل الصفحة. كل نتيجة يجب أن تحمل معرّفًا ومنصة وبناءً وتاريخًا.</p>
        <div class="meta-grid">
          <div class="meta-row"><span>آخر تدقيق UTC</span><b>${escapeHtml(ledger.auditedAtUtc)}</b></div>
          <div class="meta-row"><span>البناء</span><b>${escapeHtml(ledger.identity.gitShort)} / ${escapeHtml(ledger.identity.pubspec)}</b></div>
        </div>
      </section>
      <section class="section card">
        <h3>فهرس الأدلة</h3>
        <ul>${(ledger.evidenceIndex || [])
          .map((e) => `<li><b>${escapeHtml(e.id)}</b> — <code>${escapeHtml(e.path)}</code></li>`)
          .join("")}</ul>
      </section>
      <section class="section card">
        <h3>فحص وسائط الكتالوج الحي (خادم)</h3>
        <pre style="white-space:pre-wrap;color:var(--muted);margin:0">${escapeHtml(JSON.stringify(media, null, 2) || "لا بيانات بعد")}</pre>
      </section>
      <section class="section card">
        <h3>مطلوب من المالك لإكمال التحقق</h3>
        <div class="list">${(ledger.ownerActionsRequired || [])
          .map(
            (o) => `<article>
            <h4>${escapeHtml(o.id)} · ${escapeHtml(o.title)}</h4>
            <p>${escapeHtml(o.need)}</p>
          </article>`
          )
          .join("")}</div>
      </section>`;
  }

  function paint(view) {
    const [title, sub] = titles[view] || titles.home;
    pageTitle.textContent = title;
    pageSubtitle.textContent = sub;
    document.querySelectorAll(".nav button[data-view]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
    if (view === "home") viewRoot.innerHTML = renderHome();
    else if (view === "blockers") viewRoot.innerHTML = renderBlockers();
    else if (view === "journeys") viewRoot.innerHTML = renderJourneys();
    else if (view === "requirements") viewRoot.innerHTML = renderRequirements();
    else if (view === "gaps") viewRoot.innerHTML = renderGaps();
    else if (view === "clips") viewRoot.innerHTML = renderClips();
    else if (view === "evidence") viewRoot.innerHTML = renderEvidence();
    else viewRoot.innerHTML = renderHome();

    viewRoot.querySelectorAll("[data-open-checklist]").forEach((el) => {
      const open = () => {
        const platform = el.getAttribute("data-open-checklist");
        const panel = document.getElementById("checklistPanel");
        const table = document.getElementById("checklistTable");
        const titleEl = document.getElementById("checklistTitle");
        if (!panel || !table) return;
        titleEl.textContent = `بنود حساب نسبة ${platform === "ios" ? "iOS" : "Android"}`;
        table.innerHTML = checklistTable(platform);
        panel.classList.remove("hidden");
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
    const closeBtn = document.getElementById("closeChecklist");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        document.getElementById("checklistPanel")?.classList.add("hidden");
      });
    }
  }

  function showApp() {
    if (bootError) bootError.classList.add("hidden");
    appShell.classList.remove("hidden");
    paint("home");
  }

  function showBootError(message, opts) {
    appShell.classList.add("hidden");
    if (bootErrorText) bootErrorText.textContent = message || "تعذّر تحميل سجل النتائج.";
    if (bootError) bootError.classList.remove("hidden");
    const keyWrap = document.getElementById("adminKeyWrap");
    if (keyWrap) keyWrap.classList.toggle("hidden", !(opts && opts.needKey));
  }

  async function loadClipReport() {
    const key = adminKey();
    if (!key) {
      clipReport = null;
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/admin/store-readiness/clip-perf`, {
        cache: "no-store",
        headers: { Accept: "application/json", "X-Admin-Key": key },
      });
      if (res.ok) clipReport = await res.json();
      else clipReport = null;
    } catch (_) {
      clipReport = null;
    }
  }

  async function boot() {
    try {
      await loadLedger();
      await loadClipReport();
      showApp();
    } catch (e) {
      const needKey = e && (e.code === "ADMIN_KEY_REQUIRED" || e.code === "ADMIN_KEY_INVALID");
      const msg =
        e && e.code === "ADMIN_KEY_REQUIRED"
          ? "هذا الموقع خاص بالإدارة. أدخلي مفتاح الإدارة للمتابعة."
          : e && e.code === "ADMIN_KEY_INVALID"
            ? "مفتاح الإدارة غير صالح."
            : e.message || "تعذّر تحميل سجل النتائج.";
      showBootError(msg, { needKey: true });
    }
  }

  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      const input = document.getElementById("adminKeyInput");
      if (input) setAdminKey(input.value);
      boot();
    });
  }

  document.querySelectorAll(".nav button[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      paint(btn.dataset.view);
      sidebar.classList.remove("open");
      backdrop.classList.remove("show");
    });
  });

  menuToggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
    backdrop.classList.toggle("show");
  });
  backdrop.addEventListener("click", () => {
    sidebar.classList.remove("open");
    backdrop.classList.remove("show");
  });

  boot();
})();
