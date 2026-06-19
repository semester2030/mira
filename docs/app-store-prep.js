(function () {
  var STORAGE_KEY = "mira-app-store-prep-v1";

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function updateProgress() {
    var tasks = document.querySelectorAll(".prep-task input[type=checkbox]");
    var done = 0;
    tasks.forEach(function (cb) {
      if (cb.checked) done += 1;
    });
    var total = tasks.length;
    var pct = total ? Math.round((done / total) * 100) : 0;

    var fill = document.getElementById("prepProgressFill");
    var text = document.getElementById("prepProgressText");
    if (fill) fill.style.width = pct + "%";
    if (text) text.textContent = done + " / " + total + " (" + pct + "%)";

    document.querySelectorAll(".prep-part").forEach(function (part) {
      var partTasks = part.querySelectorAll(".prep-task input[type=checkbox]");
      var partDone = 0;
      partTasks.forEach(function (cb) {
        if (cb.checked) partDone += 1;
      });
      part.classList.toggle("is-complete", partTasks.length > 0 && partDone === partTasks.length);
    });
  }

  function init() {
    var state = loadState();
    document.querySelectorAll(".prep-task").forEach(function (li) {
      var id = li.getAttribute("data-task");
      var cb = li.querySelector("input[type=checkbox]");
      if (!cb || !id) return;

      cb.checked = !!state[id];
      li.classList.toggle("is-done", cb.checked);

      cb.addEventListener("change", function () {
        state[id] = cb.checked;
        saveState(state);
        li.classList.toggle("is-done", cb.checked);
        updateProgress();
      });
    });

    updateProgress();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
