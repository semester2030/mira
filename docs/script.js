const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");
const yearNode = document.getElementById("year");

if (yearNode) {
  yearNode.textContent = new Date().getFullYear().toString();
}

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    mainNav.classList.toggle("open");
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => mainNav.classList.remove("open"));
  });
}

const counters = document.querySelectorAll(".counter");
const counterObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.getAttribute("data-target")) || 0;
      let current = 0;
      const step = Math.max(1, Math.ceil(target / 40));

      const tick = () => {
        current += step;
        if (current >= target) {
          el.textContent = target.toString();
          observer.unobserve(el);
          return;
        }
        el.textContent = current.toString();
        requestAnimationFrame(tick);
      };

      tick();
    });
  },
  { threshold: 0.4 },
);

counters.forEach((counter) => counterObserver.observe(counter));
