const body = document.body;
const centerShell = document.getElementById("centerShell");
const appFooter = document.getElementById("appFooter");
const floatingGroup = document.getElementById("floatingGroup");
const topButton = document.getElementById("topButton");
const searchButton = document.getElementById("searchButton");

const COLUMN_FALLBACKS = [
  {
    category: "여행",
    title: "언젠가 가보고 싶었던 울릉도, 혼자여도 떠나요",
  },
  {
    category: "생활법률",
    title: "집 한 채가 전부일 때, 무엇부터 준비해야 할까요",
  },
];

function updateFloatingState() {
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  body.classList.toggle("has-scrolled", scrollY > 120);
  if (topButton) topButton.tabIndex = scrollY > 120 ? 0 : -1;
  body.classList.toggle("is-compact", scrollY > 420);

  if (!floatingGroup || !centerShell || !appFooter) return;

  const centerRect = centerShell.getBoundingClientRect();
  const footerRect = appFooter.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const defaultBottom = 84; // 64px bottom navigation + 20px clearance
  const groupHeight = floatingGroup.offsetHeight;
  const safeGap = 18;

  const centerRight = Math.min(centerRect.right - 28, window.innerWidth - 18);
  floatingGroup.style.right = `${Math.max(window.innerWidth - centerRight, 18)}px`;

  const footerLimitBottom = viewportHeight - footerRect.top + safeGap;
  const nextBottom =
    footerRect.top < viewportHeight - defaultBottom - groupHeight
      ? Math.max(defaultBottom, footerLimitBottom)
      : defaultBottom;

  floatingGroup.style.bottom = `${nextBottom}px`;
}

async function hydrateColumnCards() {
  const cards = [...document.querySelectorAll("[data-column-card]")];

  cards.forEach((card, index) => {
    const fallback = COLUMN_FALLBACKS[index];
    if (!fallback) return;

    card.querySelector("[data-category]").textContent = fallback.category;
    card.querySelector("[data-title]").textContent = fallback.title;
  });

  /*
    시놀칼럼 썸네일 연동 기준
    - 현재 프로토타입은 수동 링크를 카드 href로 둡니다.
    - 브라우저에서 외부 HTML fetch가 허용되면 og:image와 og:title을 읽어 임시 반영합니다.
    - CORS 또는 아임웹 정책으로 막히면 위 fallback UI가 유지됩니다.
    - 실제 Flutter/Web 통합 시에는 서버 또는 같은 도메인 API에서
      { title, category, thumbnailUrl, linkUrl } 형태로 내려받는 방식을 권장합니다.
  */
  await Promise.allSettled(
    cards.map(async (card) => {
      const response = await fetch(card.href, { mode: "cors" });
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const title =
        doc.querySelector('meta[property="og:title"]')?.content ||
        doc.querySelector("title")?.textContent;
      const image =
        doc.querySelector('meta[property="og:image"]')?.content ||
        doc.querySelector('meta[name="twitter:image"]')?.content;

      if (title) {
        card.querySelector("[data-title]").textContent = title.replace(" | 시놀", "").trim();
      }

      if (image) {
        const thumb = card.querySelector("[data-thumb]");
        thumb.style.backgroundImage = `url("${image}")`;
      }
    }),
  );
  fitSidebars();
}

topButton?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

searchButton?.addEventListener("click", () => {
  alert("기존 Flutter Web의 모임 검색 기능을 그대로 연결하는 기준입니다.");
});

window.addEventListener("scroll", updateFloatingState, { passive: true });
window.addEventListener("resize", () => { fitSidebars(); updateFloatingState(); });
document.querySelector(".company-info")?.addEventListener("toggle", (event) => {
  updateFloatingState();
  if (!event.currentTarget.open) return;
  requestAnimationFrame(() => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  });
});
window.addEventListener("load", updateFloatingState);

// RESPONSIVE SHELL ONLY. Never resize/transform the actual Flutter application.
// Figma reference: 320px side, 30px horizontal padding, 100px vertical padding,
// 60px section gaps at the 1920 × 1080 design. Fluid rules below are intentional.
function fitSidebars() {
  const sides = [...document.querySelectorAll(".side")];
  if (window.matchMedia("(max-width: 1035px)").matches) { updateBodyPeople(); return; }
  const viewportHeight = window.innerHeight;
  const padding = Math.min(100, Math.max(16, (viewportHeight - 780) / 3));
  const gap = Math.min(60, Math.max(16, 16 + (viewportHeight - 800) * 44 / 280));
  // Shared tiers: A banners, B columns (where present), C download branding.
  // Restore first so increasing viewport height brings sections back.
  const scale = Math.min(1, ...sides.map(side => side.clientWidth / 320));
  sides.forEach(side => side.style.setProperty("--side-scale", scale));
  for (const side of sides) {
    side.classList.remove("hide-side-c", "hide-side-b", "side-scrollable");
    const content = side.querySelector(".side-content");
    content.style.paddingBlock = `${padding}px`;
    content.style.gap = `${gap}px`;
    content.style.minHeight = "0px";
    content.style.transform = `scale(${scale})`;
    content.style.left = `${Math.max(0, (side.clientWidth - 320 * scale) / 2)}px`;
  }
  const overflows = () => sides.some(side =>
    side.querySelector(".side-content").offsetHeight * scale > viewportHeight + 1
  );
  // Tighten outer spacing before removing an entire group.
  let fittedPadding = padding;
  let fittedGap = gap;
  while (overflows() && (fittedPadding > 16 || fittedGap > 16)) {
    fittedPadding = Math.max(16, fittedPadding - 4);
    fittedGap = Math.max(16, fittedGap - 4);
    sides.forEach(side => {
      const content = side.querySelector(".side-content");
      content.style.paddingBlock = `${fittedPadding}px`;
      content.style.gap = `${fittedGap}px`;
    });
  }
  for (const tier of ["hide-side-c", "hide-side-b"]) {
    if (!overflows()) break;
    sides.forEach(side => side.classList.add(tier));
  }
  for (const side of sides) {
    const content = side.querySelector(".side-content");
    content.style.minHeight = `${viewportHeight / scale}px`;
    side.querySelector(".side-stage").style.height = `${viewportHeight}px`;
    side.style.setProperty("--side-scale", scale);
    side.dataset.scale = scale.toFixed(4);
  }
  updateBodyPeople();
}
// Keep the illustration in the body's outer right gutter with 24px clearance.
// visibility:hidden preserves its measurable box, avoiding show/hide oscillation.
function updateBodyPeople() {
  const people = document.getElementById("bodyPeople");
  const rightSide = document.querySelector(".side-right");
  if (!people || !rightSide) return;
  const showSides = getComputedStyle(rightSide).display !== "none";
  const safe = showSides && people.getBoundingClientRect().left >= rightSide.getBoundingClientRect().right + 24;
  people.classList.toggle("is-visible", safe);
}
window.addEventListener("load", fitSidebars);
document.fonts?.ready.then(fitSidebars);
fitSidebars();
hydrateColumnCards();
updateFloatingState();
