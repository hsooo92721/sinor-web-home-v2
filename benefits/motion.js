/* 시놀 회원 혜택 — 모션 · 화면 보조 동작
   app.js(신청·측정 로직)와 독립. 모션 줄이기 설정이면 이동 효과 없이 바로 보임.
   1) 스크롤 등장(한 번)  2) 첫 화면  3) 장식 이미지 패럴랙스  4) 화면 밖 장식 애니메이션 정지
   5) FAQ 대표 5개 + 더 보기  6) 안내 문구 */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  root.classList.add('js');
  var hasIO = 'IntersectionObserver' in window;

  /* 1. 스크롤 등장 — 한 번 나타난 뒤에는 고정 */
  var targets = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  targets.forEach(function (el) {
    var sibs = Array.prototype.filter.call(el.parentElement.children, function (c) { return c.classList.contains('reveal'); });
    var i = sibs.indexOf(el);
    if (i > 0) el.style.transitionDelay = Math.min(i, 4) * 70 + 'ms';
  });
  if (hasIO && !reduce.matches) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -5% 0px' });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* 2. 첫 화면 */
  requestAnimationFrame(function () { document.body.classList.add('is-loaded'); });

  /* 3. 장식 이미지만 약한 패럴랙스 (태블릿 이상) */
  var depthEls = Array.prototype.slice.call(document.querySelectorAll('[data-depth]'));
  var wide = window.matchMedia('(min-width: 768px)');
  var ticking = false;
  function frame() {
    ticking = false;
    var on = wide.matches && !reduce.matches;
    var vh = window.innerHeight;
    depthEls.forEach(function (o) {
      if (!on) { o.style.setProperty('--py', '0px'); return; }
      var r = o.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      o.style.setProperty('--py', (-((r.top + r.height / 2) - vh / 2) * parseFloat(o.dataset.depth)).toFixed(1) + 'px');
    });
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  frame();

  /* 4. 화면 밖에 있는 장식 애니메이션은 멈춤 */
  if (hasIO) {
    var floaters = Array.prototype.slice.call(document.querySelectorAll('.hero__kv, .bonus__coin, .hero__cta .bubble'));
    var vio = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { en.target.classList.toggle('is-off', !en.isIntersecting); });
    });
    floaters.forEach(function (el) { vio.observe(el); });
  }

  /* 5. FAQ — 대표 질문 5개 먼저, 나머지는 더 보기 */
  var list = document.getElementById('faq-list');
  var more = document.getElementById('faq-more');
  if (list && more) {
    var extra = list.querySelectorAll('.faq__more').length;
    if (extra) {
      more.hidden = false;
      more.textContent = '질문 ' + extra + '개 더 보기';
      more.addEventListener('click', function () {
        var open = !list.classList.contains('is-all');
        list.classList.toggle('is-all', open);
        more.setAttribute('aria-expanded', String(open));
        more.textContent = open ? '질문 접기' : '질문 ' + extra + '개 더 보기';
        if (open) { var first = list.querySelector('.faq__more summary'); if (first) first.focus(); }
      });
    }
  }

  /* 6. 안내 문구 */
  var tip = document.getElementById('sticky-tip');
  var x = tip && tip.querySelector('.sticky-tip__x');
  if (x) x.addEventListener('click', function () { tip.hidden = true; });
  /* 7. 접힌 질문으로 이동하는 링크(예: 개인정보 제공 안내 보기)는 그 질문을 펼침 */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-scroll]');
    var t = b && document.getElementById(b.dataset.scroll);
    if (t && t.tagName === 'DETAILS') t.open = true;
  });

  /* 8. 맨 위로 버튼 — 첫 화면을 지나면 표시 */
  var totop = document.getElementById('totop');
  var heroEl = document.getElementById('hero');
  if (totop && heroEl && hasIO) {
    totop.hidden = false;
    new IntersectionObserver(function (ents) {
      totop.classList.toggle('is-on', !ents[0].isIntersecting);
      totop.tabIndex = ents[0].isIntersecting ? -1 : 0;
    }).observe(heroEl);
    // 하단 고정 버튼이 보이면 그 위로 비켜섬 (:has 미지원 브라우저 대비 JS로 처리)
    var stickyEl = document.getElementById('sticky-cta');
    var lift = function () {
      var on = !!stickyEl && stickyEl.classList.contains('is-visible');
      totop.classList.toggle('is-lifted', on);
      // 하단 고정 영역의 실제 높이(안내 문구·Safe Area 포함)만큼 띄움
      totop.style.bottom = on ? (stickyEl.offsetHeight + 12) + 'px' : '';
    };
    window.addEventListener('resize', lift);
    var tipX = document.querySelector('.sticky-tip__x');
    if (tipX) tipX.addEventListener('click', function () { setTimeout(lift, 0); });
    if (stickyEl) new MutationObserver(lift).observe(stickyEl, { attributes: true, attributeFilter: ['class'] });
    lift();
    totop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' });
      var first = document.querySelector('.hero__cta .btn');
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 400);
    });
  }

  /* 9. 주소에 #my-benefits 같은 섹션 링크가 있으면 페이지가 다 그려진 뒤 그 위치로 바로 이동 (예전 주소 #my-status도 지원) */
  function jumpToHash() {
    var id = decodeURIComponent((location.hash || '').slice(1));
    if (id === 'my-status') id = 'my-benefits';
    var el = id && document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'auto', block: 'start' });
  }
  if (location.hash) window.addEventListener('load', function () { setTimeout(jumpToHash, 0); });
  window.addEventListener('hashchange', jumpToHash);
})();
