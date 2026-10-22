(function () {
  const data = window.MIRA_CONSULT_DIALOGUE;
  const root = document.getElementById("dialogue");
  if (!data || !root) return;

  const stateAr = {
    implemented: "منفّذ",
    implemented_blocked_live: "منفّذ — حيّ متعذر",
    in_progress: "قيد التنفيذ",
    done: "مكتمل",
    verified_local: "متحقق محليًا",
    verified_model: "متحقق بالنموذج",
    awaiting_device: "بانتظار الجهاز",
    awaiting_live: "بانتظار اختبار حي",
    not_run: "لم يُشغَّل",
    blocked: "موقوف",
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  const repairs = Array.isArray(data.repairs) ? data.repairs : [];
  const results = Array.isArray(data.results) ? data.results : [];
  const remaining = Array.isArray(data.remaining) ? data.remaining : [];
  const decisions = Array.isArray(data.decisions) ? data.decisions : [];
  const unchanged = Array.isArray(data.unchangedRisks) ? data.unchangedRisks : [];
  const release = data.release || {};
  const prior = data.priorRelease || {};

  const counts = {
    total: tasks.length,
    done: tasks.filter((t) =>
      ["done", "verified_local", "verified_model", "implemented"].includes(t.state)
    ).length,
    blocked: tasks.filter((t) =>
      ["blocked", "implemented_blocked_live", "awaiting_live", "not_run"].includes(t.state)
    ).length,
    repairs: repairs.length,
  };

  function taskRows(filterState) {
    return tasks
      .filter((task) => !filterState || task.state === filterState)
      .map(
        (task) => `<tr data-state="${esc(task.state)}">
      <td>${esc(task.id)}</td>
      <td>${esc(task.title)}</td>
      <td><span class="status status-${esc(task.state)}">${esc(
          stateAr[task.state] || task.state
        )}</span></td>
      <td>${esc(task.evidence)}</td>
    </tr>`
      )
      .join("");
  }

  const repairCards = repairs
    .map(
      (item, index) => `<article class="panel repair" data-repair="${index}">
      <h3>بند ${index + 1}: ${esc(item.problem || "")}</h3>
      <dl>
        <dt>السبب</dt><dd>${esc(item.cause || "")}</dd>
        <dt>الملفات</dt><dd>${esc(item.files || "")}</dd>
        <dt>الإصلاح</dt><dd>${esc(item.fix || "")}</dd>
        <dt>الاختبار / الدليل</dt><dd>${esc(item.check || "")}</dd>
      </dl>
    </article>`
    )
    .join("");

  const resultItems = results
    .map((item) => {
      const link = item.file
        ? ` — <code>${esc(item.file)}</code>`
        : "";
      return `<li>${esc(item.name)}: ${esc(item.value)}${link}</li>`;
    })
    .join("");

  root.innerHTML = `
    <p class="pill">${esc(data.id)} · ${esc(data.approval)}</p>
    <p>آخر تحديث ${esc(data.updatedAt)}. المهام ${counts.done}/${counts.total} · إصلاحات ${counts.repairs} · متعذر/مفتوح ${counts.blocked}.</p>
    <div class="counts" role="group" aria-label="أعداد البنود">
      <article class="card"><strong>${counts.total}</strong>مهام</article>
      <article class="card"><strong>${counts.repairs}</strong>إصلاحات</article>
      <article class="card"><strong>${counts.done}</strong>منفّذ/مكتمل</article>
      <article class="card"><strong>${counts.blocked}</strong>مفتوح/متعذر</article>
    </div>
    <h2>حالة الإصدار</h2>
    <ul>
      <li>نُشر: ${esc(release.published || "—")}</li>
      <li>اختُبر تقنيًا: ${esc(release.technicallyTested || "—")}</li>
      <li>بانتظار المالك: ${esc(release.awaitingOwner || "—")}</li>
      ${prior.id ? `<li>السابق: ${esc(prior.id)} — ${esc(prior.published || prior.note || "")}</li>` : ""}
    </ul>
    <article class="panel"><h2>النطاق</h2><p>${esc(data.scope || "")}</p></article>
    ${
      decisions.length
        ? `<h2>القرارات</h2><ul>${decisions
            .map((item) => `<li>${esc(item)}</li>`)
            .join("")}</ul>`
        : ""
    }
    <h2>سجل الإصلاحات (${repairs.length})</h2>
    ${repairCards || "<p>لا بنود إصلاح مسجّلة.</p>"}
    <h2>المهام والحالات</h2>
    <div class="filters" role="group" aria-label="تصفية المهام">
      <label>الحالة
        <select id="filterTaskState">
          <option value="">الكل</option>
          ${Object.keys(stateAr)
            .map((k) => `<option value="${esc(k)}">${esc(stateAr[k])}</option>`)
            .join("")}
        </select>
      </label>
      <button type="button" id="btnShowAllTasks">إظهار الكل</button>
    </div>
    <table class="dialogue-table">
      <thead><tr><th>المعرف</th><th>المهمة</th><th>الحالة</th><th>الدليل</th></tr></thead>
      <tbody id="taskBody">${taskRows("")}</tbody>
    </table>
    <h2>النتائج</h2>
    <ul>${resultItems || "<li>لا نتائج بعد.</li>"}</ul>
    <h2>المتبقي</h2>
    <ul>${remaining.map((item) => `<li>${esc(item)}</li>`).join("") || "<li>لا متبقي مسجّل.</li>"}</ul>
    ${
      unchanged.length
        ? `<p class="note">سجلات لم تُعالج في هذه الدفعة: ${esc(
            unchanged.join("، ")
          )}.</p>`
        : ""
    }
    <p class="dialogue-links"><a href="index.html">العودة إلى الملخص</a></p>
  `;

  const body = document.getElementById("taskBody");
  const select = document.getElementById("filterTaskState");
  const showAll = document.getElementById("btnShowAllTasks");
  function applyFilter() {
    if (!body || !select) return;
    body.innerHTML = taskRows(select.value);
  }
  if (select) select.addEventListener("change", applyFilter);
  if (showAll)
    showAll.addEventListener("click", () => {
      if (select) select.value = "";
      applyFilter();
    });
})();
