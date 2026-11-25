/* 시놀 혜택 서비스 — 프로토타입 동작 */
(function () {
  'use strict';

  const C = window.SINOR_CONFIG;
  const A = window.SinorAnalytics;
  const BENEFITS = ['onyu', 'outfitcode']; // 주력: 온유상조
  const STORE_KEY = 'sinor-benefit-proto-v1';

  /* ---------------- 상태 ---------------- */
  const STATUS = {
    available: { label: '신청 가능', step: -1 },
    photos_needed: { label: '사진 제출 필요', step: 0 },
    applied: { label: '신청 완료', step: 0 },
    processing: { label: '처리 중', step: 1 },
    delivered: { label: '혜택 제공 완료', step: 2 },
    failed: { label: '확인 필요', step: 1 },
  };
  const DESC = {
    outfitcode: {
      available: '설문과 사진 2장으로 나만의 스타일 리포트를 받아 보세요.',
      photos_needed: '얼굴·전신 정면 사진 2장만 올리면 신청이 끝나요.',
      applied: '사진까지 잘 받았어요. 곧 아웃핏코드에서 리포트를 만들기 시작해요.',
      processing: '아웃핏코드 전문가가 회원님의 리포트를 만들고 있어요.',
      delivered: '스타일 리포트를 이메일로 보내 드렸어요.',
      failed: '신청 내용을 확인하는 과정에서 문제가 생겼어요. 다시 신청하거나 카카오톡 채널 ‘시놀’로 문의해 주세요.',
    },
    onyu: {
      available: '가입비·월 납입금 없이 상조 준비를 끝내 두세요.',
      photos_needed: '',
      applied: '신청을 받았어요. 곧 온유상조에서 가입을 확인해요.',
      processing: '온유상조에서 가입 내용을 확인하고 있어요.',
      delivered: '온유프리멤버스 가입이 끝났어요. 이제 상조 준비 걱정은 덜어 두세요.',
      failed: '가입 내용을 확인하는 과정에서 문제가 생겼어요. 다시 신청하거나 카카오톡 채널 ‘시놀’로 문의해 주세요.',
    },
  };

  function defaultState() { return { status: { outfitcode: 'available', onyu: 'available' } }; }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE_KEY)); if (s && s.status) return s; } catch (e) { /* noop */ }
    return defaultState();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* noop */ } }

  let S = load();
  const proto = { failNext: false };

  const STEPS = {
    outfitcode: ['신청', '사진 제출', '처리 중', '혜택 제공 완료'],
    onyu: ['신청 완료', '처리 중', '혜택 제공 완료'],
  };
  function stepIndex(b, st) {
    const oc = b === 'outfitcode';
    return { photos_needed: 0, applied: oc ? 1 : 0, processing: oc ? 2 : 1, delivered: oc ? 3 : 2, failed: oc ? 2 : 1 }[st];
  }
  const needsPhotos = (b) => S.status[b] === 'photos_needed';
  const canApply = (b) => S.status[b] === 'available' || S.status[b] === 'failed';
  const remaining = () => BENEFITS.filter(canApply);
  const applyType = (list) => (list.length === 2 ? 'bundle' : list[0] || 'choose'); // choose: 아직 고르지 않음(원하는 혜택만 받기)
  const bName = (b) => C.benefits[b].name;

  /* ---------------- 유틸 ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const getPath = (path) => path.split('.').reduce((o, k) => (o ? o[k] : undefined), C);

  function tbdHTML(label) {
    return `<span class="tbd"><b class="tbd__k">확인 필요</b><span class="tbd__l">${esc(label)}</span><span class="tbd__alt">추후 안내 예정</span></span>`;
  }
  function cfgHTML(entry) {
    if (!entry) return '';
    if (entry.value) return esc(entry.value);
    return tbdHTML(entry.tbd || '내용');
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 3200);
  }

  /* ---------------- 정적 콘텐츠 바인딩 ---------------- */
  function bindStatic() {
    $$('[data-cfg]').forEach((el) => { el.innerHTML = cfgHTML(getPath(el.dataset.cfg)); });
    $$('[data-member="name"]').forEach((el) => { el.textContent = C.member.name; });
    $$('[data-apply]').forEach((el) => { el.dataset.label = el.textContent.trim(); });
  }

  /* ---------------- CTA 라벨 갱신 ---------------- */
  function updateCtas() {
    const rem = remaining();
    $$('[data-apply]').forEach((el) => {
      if (el.closest('#sheet') || el.closest('#status-board')) return;
      const t = el.dataset.apply;
      el.classList.remove('is-done');
      if (t === 'choose') {
        el.hidden = rem.length < 2; // 고를 혜택이 2개일 때만 의미 있음
      } else if (t === 'bundle') {
        if (rem.length === 2) el.textContent = el.dataset.label;
        else if (rem.length === 1) el.textContent = rem[0] === 'onyu' ? '온유상조 가입하기' : '스타일 리포트 받기';
        else el.textContent = '신청 내역 보기';
      } else if (canApply(t)) {
        el.textContent = el.dataset.label;
      } else if (needsPhotos(t)) {
        el.textContent = el.closest('.hero__split') ? '사진 올리기' : '사진 올리기';
      } else if (el.closest('.hero__split')) {
        el.textContent = `${bName(t)} ${STATUS[S.status[t]].label}`;
      } else {
        el.textContent = `${STATUS[S.status[t]].label} · 내역 보기`;
        el.classList.add('is-done');
      }
      const bub = el.parentElement.querySelector('.bubble');
      if (bub && t !== 'choose') bub.hidden = t === 'bundle' ? rem.length === 0 : !canApply(t); // 아직 안 받은 혜택이 있을 때만 말풍선
    });
    renderBoard();
  }

  /* ---------------- 혜택 현황 카드 ---------------- */
  function statusCard(b, ctx) {
    const st = S.status[b];
    const meta = STATUS[st];
    const steps = STEPS[b];
    let track = '';
    if (st !== 'available') {
      const idx = stepIndex(b, st);
      track = `<ol class="track" style="grid-template-columns:repeat(${steps.length},1fr)" aria-label="진행 단계">${steps.map((s, i) => {
        const fail = st === 'failed' && i === idx;
        const todo = st === 'photos_needed' && i === 1;
        const on = i <= idx;
        const cur = i === idx;
        return `<li class="${fail ? 'is-fail' : todo ? 'is-todo' : on ? 'is-on' : ''}">${fail ? '확인 필요' : s}${cur || todo ? '<span class="sr-only"> (현재 단계)</span>' : ''}</li>`;
      }).join('')}</ol>`;
    }
    let action = '';
    if (st === 'available') {
      action = `<button type="button" class="btn ${b === 'outfitcode' ? 'btn--oc' : 'btn--on'}" data-cta="${ctx}_apply_${b}" data-apply="${b}">${b === 'onyu' ? '무료 가입하기' : '무료 리포트 받기'}</button>`;
    } else if (st === 'photos_needed') {
      action = `<button type="button" class="btn btn--oc" data-cta="${ctx}_photos_${b}" data-photos>사진 올리기</button>`;
    } else if (ctx === 'status_board' && st !== 'failed') {
      action = `<button type="button" class="btn btn--ghost" data-cta="${ctx}_view_${b}" data-open="status">신청 내역 보기</button>`;
    }
    if (st === 'failed') {
      action = `<button type="button" class="btn btn--ink" data-cta="${ctx}_reapply_${b}" data-apply="${b}">다시 신청하기</button>
        <button type="button" class="btn btn--ghost" data-cta="${ctx}_contact_${b}" data-contact>카카오톡 문의</button>`;
    }
    return `<div class="brow brow--${b}">
      <div class="brow__top">
        <div><p class="brow__name">${bName(b)}</p><p class="brow__what">${b === 'onyu' ? '가입비·월 납입금 0원' : '맞춤 스타일 리포트 무료'}</p></div>
        <span class="badge badge--${st}">${meta.label}</span>
      </div>
      ${track}
      <p class="brow__desc">${DESC[b][st]}</p>
      ${action}
    </div>`;
  }
  function pointsHTML() {
    if (!C.points.enabled) return '';
    S.survey = S.survey || {};
    const earned = BENEFITS.filter((b) => S.survey[b]);
    const pending = surveyPendingBenefits();
    let html = '';
    if (earned.length) html += `<div class="points-note points-note--done"><b>${ptsFmt(earned.length)} 지급 완료</b><span>${earned.map(bName).join('·')} 설문을 마쳐서 바로 드렸어요</span></div>`;
    if (pending.length) html += `<div class="points-note"><b>설문하고 ${ptsFmt(pending.length)} 더 받으세요</b><span>${pending.map(bName).join('·')} 설문이 남아 있어요 (혜택별 설문 참여 시 500P씩)</span><button type="button" class="btn btn--ink" data-cta="status_survey_later" data-survey-later>설문하고 ${ptsFmt(pending.length)} 받기</button></div>`;
    // 설문 전(지급·대기 없음)에는 포인트 홍보 배너를 따로 띄우지 않음 — 안내는 '두 가지 모두' 영역에 한 번만
    return html;
  }
  function renderBoard() { $('#status-board').innerHTML = pointsHTML() + BENEFITS.map((b) => statusCard(b, 'status_board')).join(''); }

  /* ---------------- 시트(모달) ---------------- */
  const root = $('#sheet-root');
  const sheet = $('#sheet');
  const body = $('#sheet-body');
  const foot = $('#sheet-foot');
  const outside = () => [$('main'), $('.topbar'), $('.app-footer'), $('#sticky-cta')]; // 공용 푸터도 시트가 열리면 비활성
  let lastFocus = null;
  let view = null; // 'form' | 'done' | 'status'

  function openSheet() {
    if (!root.hidden) return;
    lastFocus = document.activeElement;
    root.hidden = false;
    document.body.classList.add('is-locked');
    outside().forEach((el) => el && el.setAttribute('inert', ''));
    updateSticky();
  }
  function closeSheet(reason, discard = false) {
    if (root.hidden) return;
    if (!discard && view === 'photos' && P && !P.submitted && ['face', 'body'].some((k) => P[k])) {
      if ($('#photo-leave-confirm')) return;
      const previousFocus = document.activeElement;
      const confirm = document.createElement('div');
      confirm.id = 'photo-leave-confirm';
      confirm.className = 'photo-leave-confirm';
      confirm.innerHTML = '<div role="alertdialog" aria-modal="true" aria-labelledby="photo-leave-title" aria-describedby="photo-leave-message"><h3 id="photo-leave-title">사진 등록을 종료할까요?</h3><p id="photo-leave-message">등록 중인 사진은 저장되지 않습니다.</p><div class="photo-leave-actions"><button type="button" data-stay>계속 등록</button><button type="button" data-leave>나가기</button></div></div>';
      const cancel = () => { confirm.remove(); sheet.removeAttribute('inert'); previousFocus?.focus(); };
      sheet.setAttribute('inert', '');
      confirm.querySelector('[data-stay]').onclick = cancel;
      confirm.querySelector('[data-leave]').onclick = () => { confirm.remove(); sheet.removeAttribute('inert'); closeSheet(reason, true); };
      confirm.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
        if (e.key === 'Tab') { e.preventDefault(); const buttons = [...confirm.querySelectorAll('button')]; buttons[document.activeElement === buttons[0] ? 1 : 0].focus(); e.stopPropagation(); }
      });
      root.append(confirm); confirm.querySelector('[data-stay]').focus(); return;
    }
    if (view === 'form' && F && !F.submitted) trackAbandon(reason || 'close');
    if (view === 'photos' && P && !P.submitted) A.track('photo_abandon', { source: reason || 'close', filled_count: ['face', 'body'].filter((k) => P[k]).length, required_count: 2 });
    if (P) { ['face', 'body'].forEach((k) => P[k] && URL.revokeObjectURL(P[k].url)); P = null; }
    root.hidden = true;
    document.body.classList.remove('is-locked');
    outside().forEach((el) => el && el.removeAttribute('inert'));
    view = null;
    updateSticky();
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus();
  }
  function focusTitle() { const t = $('#sheet-title'); t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); body.scrollTop = 0; }

  root.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeSheet('close_button'); });
  document.addEventListener('keydown', (e) => {
    if (root.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeSheet('escape'); return; }
    if (e.key === 'Tab') {
      const f = $$('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])', sheet).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0]; const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === $('#sheet-title'))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------------- 신청 폼 (3단계: 정보 → 설문 → 동의) ---------------- */
  let F = null;
  const STEP_NAMES = ['정보 입력', '약관 동의'];
  const STEP_KEYS = ['info', 'consent'];

  function newForm(list, source) {
    return {
      step: 1,
      selected: new Set(list),
      realname: C.member.name || '', height: '', weight: '', email: '', // 이메일은 예시값을 채우지 않고 직접 입력받음
      answers: {}, consents: {},
      open: new Set(), errors: {}, touched: new Set(), completed: new Set(),
      submitting: false, submitted: false, failed: false, skippedSurvey: false,
      source, startedAt: Date.now(), maxStep: 'info',
    };
  }

  function openApply(list, source) {
    F = newForm(list, source);
    view = 'form';
    openSheet();
    renderForm();
    focusTitle();
    A.track('apply_start', { cta_id: source, apply_type: applyType(list), benefits: list.join(','), selected_count: list.length });
  }

  const selList = () => BENEFITS.filter((b) => F.selected.has(b));
  const neededFields = () => Object.keys(C.fields).filter((k) => C.fields[k].requiredBy.some((b) => F.selected.has(b)));
  const surveyQs = () => selList().flatMap((b) => (C.surveys[b] || []).map((q) => Object.assign({ benefit: b }, q)));
  const surveyDone = () => surveyQs().every((q) => (F.answers[q.id] || '').trim());
  const visibleConsents = () => {
    const sel = selList();
    const ids = [];
    if (C.mergeThirdParty) { if (sel.length) ids.push('thirdparty'); } else sel.forEach((b) => ids.push('tp_' + b));
    if (sel.includes('onyu')) ids.push('onyu_terms');
    if (sel.includes('outfitcode')) ids.push('oc_collect');
    if (sel.includes('onyu')) ids.push('onyu_marketing');
    return ids;
  };
  // 포인트: 설문만 마쳐도 지급 (1인 1회)
  const otherDone = (b) => !canApply(b);
  const PER_SURVEY = 500;
  const ptsFmt = (n) => `${(n * PER_SURVEY).toLocaleString('ko-KR')}P`;
  const notYet = (b) => !((S.survey || {})[b]);
  const pointsEligibleNow = () => C.points.enabled && (!F || selList().some(notYet));
  const benefitAnswered = (b) => (C.surveys[b] || []).length > 0 && (C.surveys[b] || []).every((q) => (F.answers[q.id] || '').trim());

  function rowsHTML(rows) {
    return rows.map(([t, v, tbd]) => `<div><dt>${esc(t)}</dt><dd>${v ? esc(v) : tbdHTML(tbd || '내용')}</dd></div>`).join('');
  }

  function consentHTML(id) {
    const c = C.consents[id];
    const checked = F.consents[id];
    const open = F.open.has(id);
    const err = F.errors['consent_' + id];
    const label = c.merged ? `${c.label} (${selList().map(bName).join('·')})` : c.label;
    let rows;
    if (c.merged) {
      rows = `<div><dt>제공하는 자</dt><dd>${esc(c.provider)}</dd></div>` + selList().map((b) => {
        const tp = C.consents['tp_' + b];
        return `<div class="cdetail__group"><dt class="cdetail__who">${bName(b)}에 제공</dt><dd><dl>${rowsHTML(tp.rows)}${tp.tbd ? `<div><dt>검토 메모</dt><dd>${tbdHTML(tp.tbd)}</dd></div>` : ''}</dl></dd></div>`;
      }).join('');
    } else {
      rows = rowsHTML(c.rows) + (c.tbd ? `<div><dt>검토 메모</dt><dd>${tbdHTML(c.tbd)}</dd></div>` : '');
    }
    return `<div class="citem">
      <div class="citem__row">
        <label class="check" for="c-${id}">
          <input type="checkbox" id="c-${id}" data-consent="${id}" ${checked ? 'checked' : ''} ${c.required ? 'aria-required="true"' : ''} ${err ? 'aria-invalid="true" aria-describedby="c-' + id + '-err"' : ''} />
          <span class="check__box" aria-hidden="true"></span>
          <span class="check__text"><span class="${c.required ? 'req' : 'opt'}">[${c.required ? '필수' : '선택'}]</span>${esc(label)}</span>
        </label>
        <button type="button" class="citem__more" data-detail="${id}" aria-expanded="${open}" aria-controls="cd-${id}">${open ? '접기' : '보기'}<span class="sr-only"> ${esc(label)} 상세 내용</span></button>
      </div>
      ${err ? `<span class="err" id="c-${id}-err" style="margin:-4px 0 10px 42px">${err}</span>` : ''}
      <dl class="cdetail" id="cd-${id}" ${open ? '' : 'hidden'}>${rows}</dl>
    </div>`;
  }

  function fieldHTML(k) {
    const f = C.fields[k];
    const err = F.errors[k];
    const isNum = !!f.unit;
    const type = isNum ? 'type="text" inputmode="decimal" autocomplete="off" maxlength="5"'
      : k === 'email' ? 'type="email" inputmode="email" autocomplete="email"' : 'type="text" autocomplete="name"';
    const ph = { height: '예) 165', weight: '예) 60', email: 'example@email.com', realname: '가입자 실명' }[k];
    return `<div class="field ${isNum ? 'field--unit' : ''} ${err ? 'is-error' : ''}">
      <label class="field__label" for="f-${k}">${f.label}${f.unit ? ` <small>(${f.unit})</small>` : ''}</label>
      <div class="field__control">
        <input id="f-${k}" name="${k}" data-field="${k}" ${type} value="${esc(F[k])}" aria-required="true"
          aria-describedby="${f.reason ? `f-${k}-why` : ''}${err ? ` f-${k}-err` : ''}" ${err ? 'aria-invalid="true"' : ''} placeholder="${ph}" />
        ${isNum ? `<span class="field__unit" aria-hidden="true">${f.unit}</span>` : ''}
      </div>
      ${err ? `<span class="err" id="f-${k}-err">${err}</span>` : ''}
      ${f.reason ? `<p class="field__why" id="f-${k}-why">${esc(f.reason)}</p>` : ''}
    </div>`;
  }

  function stepInfoHTML() {
    const sel = selList();
    const need = neededFields();
    const other = BENEFITS.find((b) => !F.selected.has(b) && canApply(b));
    const pick = BENEFITS.map((b) => {
      const locked = !canApply(b);
      const st = S.status[b];
      // 하나만 골랐을 때, 남은 혜택 옆에 말풍선으로 함께 받기 유도
      const bubble = sel.length === 1 && b === other ? `<span class="pick__bubble" aria-hidden="true">${b === 'onyu' ? '가입비 0원' : '리포트 무료'} · 함께 받기</span>` : '';
      return `<label class="pick__item pick__item--${b}" for="p-${b}">
        <input type="checkbox" id="p-${b}" data-pick="${b}" ${F.selected.has(b) ? 'checked' : ''} ${locked ? 'disabled' : ''} />
        <span class="pick__card">
          <span class="pick__box" aria-hidden="true"></span>
          <span class="pick__summary"><span class="pick__name">${bName(b)}</span><span class="pick__what">${esc(C.benefits[b].title)}</span></span>
          ${locked ? `<span class="badge badge--${st}">${STATUS[st].label}</span>` : bubble}
        </span>
      </label>`;
    }).join('');
    // 기존 '함께 받기' 박스는 말풍선으로 대체 (스크린리더용 안내만 남김)
    const nudge = sel.length === 1 && other ? `<p class="sr-only">${bName(other)}도 무료예요. 체크하면 함께 신청돼요.</p>` : '';
    const hasOc = sel.includes('outfitcode');
    return `
      <section class="fblock fblock--benefit-pick" aria-label="혜택 선택">
        <fieldset><legend class="sr-only">받을 혜택 선택</legend><div class="pick">${pick}</div></fieldset>
        ${nudge}
        ${F.errors.pick ? `<p class="err pick-error" role="alert">${F.errors.pick}</p>` : ''}
      </section>
      <section class="fblock" aria-labelledby="fb-member">
        <h3 class="fblock__title" id="fb-member">가입자 정보</h3>
        ${need.includes('realname') ? fieldHTML('realname') : ''}
        <div class="member-info">
          
          <dl>
            <div><dt>생년월일</dt><dd>${esc(C.member.birth)}</dd></div>
            <div><dt>휴대전화</dt><dd>${esc(C.member.phone)}</dd></div>
            <div><dt>성별</dt><dd>${esc(C.member.gender)}</dd></div>
          </dl>
        </div>
        <p class="fblock__why">정보가 다르면 <a class="profile-contact" href="https://pf.kakao.com/_SBhxan/chat" target="_blank" rel="noopener noreferrer">문의</a> 주세요.</p>
      </section>
      ${hasOc ? `<section class="fblock" aria-labelledby="fb-oc">
        <h3 class="fblock__title" id="fb-oc">스타일 리포트에 필요한 정보 <span class="tag-oc">아웃핏코드</span></h3>
        <div class="field__row">${fieldHTML('height')}${fieldHTML('weight')}</div>
        ${fieldHTML('email')}
        <p class="banner banner--photo"><b>아웃핏코드는 사진 2장을 올리면 신청이 끝나요.</b> 동의 후 다음 화면에서 얼굴·전신 정면 사진을 올려 주세요. 지금 없으면 나중에 올려도 돼요.</p>
      </section>` : ''}
`;
  }

  function stepSurveyHTML() {
    const qs = surveyQs();
    const q = qs[F.surveyIndex || 0];
    if (!q) return '';
    const group = qs.filter((item) => item.benefit === q.benefit);
    const index = group.findIndex((item) => item.id === q.id);
    const answer = F.answers[q.id] || '';
    return `<section class="survey-single">
      <div class="survey-single__head"><div><p class="survey-single__partner">${bName(q.benefit)} 설문</p><p class="survey-single__progress">${index + 1} / ${group.length}</p></div><img src="assets/coin-p-front.webp" width="68" height="68" alt="" /></div>
      <h3 class="survey-single__question">${esc(q.text)}</h3>
      ${q.type === 'text' ? `<textarea class="survey-single__answer" data-answer="${q.id}" aria-label="${esc(q.text)}" rows="4" maxlength="300" placeholder="${esc(q.placeholder || '')}">${esc(answer)}</textarea>` : `<fieldset class="survey-single__options"><legend class="sr-only">${esc(q.text)}</legend>${q.options.map((option, i) => `<label class="sopt"><input type="radio" name="q-${q.id}" data-answer="${q.id}" value="${esc(option)}" ${answer === option ? 'checked' : ''} /><span>${esc(option)}</span></label>`).join('')}</fieldset>`}
      </section>`;
  }

  function stepConsentHTML() {
    const vis = visibleConsents();
    const allChecked = vis.every((id) => F.consents[id]);
    const hasOc = selList().includes('outfitcode');
    return `
      <section class="fblock" aria-labelledby="fb-consent">
        <h3 class="fblock__title" id="fb-consent">약관 동의</h3>
        
        <div class="consent">

          ${vis.filter((id) => C.consents[id].required).map(consentHTML).join('')}
          ${vis.some((id) => !C.consents[id].required) ? `${vis.filter((id) => !C.consents[id].required).map(consentHTML).join('')}` : ''}
        </div>
        
      </section>`;
  }

  function renderForm() {
    if (F.later) { body.innerHTML = stepSurveyHTML(); renderLaterFoot(); return; }
    $('#sheet-title').textContent = '혜택 신청';
    const sel = selList();
    const st = F.step;
    const progress = `<div class="steps-bar" aria-label="신청 단계">
      ${STEP_NAMES.map((nm, i) => `<span class="${i + 1 <= st ? 'is-on' : ''}" ${i + 1 === st ? 'aria-current="step"' : ''}>${nm}</span>`).join('')}
    </div>
    <p class="step-k">${st}/${STEP_NAMES.length} · ${STEP_NAMES[st - 1]}</p>`;
    body.innerHTML = `
      ${F.failed ? `<div class="banner banner--error" role="alert" tabindex="-1" id="submit-error">신청이 아직 끝나지 않았어요. 입력하신 내용은 그대로 있으니, 잠시 후 다시 눌러 주세요.</div>` : ''}
      ${progress}
      ${st === 1 ? stepInfoHTML() : stepConsentHTML()}`;
    const n = sel.length;
    const mainLabel = st < 2 ? '다음' : F.submitting ? '처리 중…' : '완료';
    foot.innerHTML = `
      ${st === 2 ? `<label class="check check--all" for="c-all">
            <input type="checkbox" id="c-all" data-consent-all ${visibleConsents().every((id) => F.consents[id]) ? 'checked' : ''} />
            <span class="check__box" aria-hidden="true"></span>
            <span class="check__text">전체 동의</span>
          </label>` : ''}
      <div class="foot-row">
        <button type="button" class="btn btn--ink btn--xl" id="${st < 2 ? 'step-next' : 'submit-btn'}" ${F.submitting ? 'disabled aria-busy="true"' : ''}>${mainLabel}</button>
      </div>`;
  }

  function answeredCount() { return surveyQs().filter((q) => (F.answers[q.id] || '').trim()).length; }
  function updateSurveyFoot() {
    const q = surveyQs()[F.surveyIndex || 0];
    const btn = $('#survey-submit');
    if (btn && q) btn.disabled = !(F.answers[q.id] || '').trim() || F.submitting;
  }

  /* 신청 후 설문 (건너뛴 사람용) */
  function surveyPendingBenefits() {
    S.survey = S.survey || {};
    return BENEFITS.filter((b) => !canApply(b) && !S.survey[b] && (C.surveys[b] || []).length);
  }
  function openSurveyLater(source) {
    const list = surveyPendingBenefits();
    if (!list.length) return;
    F = newForm(list, source);
    F.step = 2; F.later = true; F.maxStep = 'survey';
    view = 'form';
    openSheet();
    renderForm();
    focusTitle();
    A.track('survey_later_start', { source, benefits: list.join(',') });
  }
  function renderLaterFoot() {
    $('#sheet-title').textContent = '설문 참여';
    const qs = surveyQs();
    const index = F.surveyIndex || 0;
    const last = index === qs.length - 1;
    foot.innerHTML = `<button type="button" class="btn btn--ink btn--xl" id="survey-submit">${last ? '완료' : '다음'}</button>`;
    updateSurveyFoot();
  }
  function submitLater() {
    const qs = surveyQs();
    const index = F.surveyIndex || 0;
    const q = qs[index];
    if (!q || !(F.answers[q.id] || '').trim() || F.submitting) return;
    const groupFinished = !qs[index + 1] || qs[index + 1].benefit !== q.benefit;
    if (groupFinished && benefitAnswered(q.benefit) && notYet(q.benefit)) {
      S.survey = S.survey || {};
      S.survey[q.benefit] = true;
      save(); updateCtas();
      A.track('points_earned', { benefit: q.benefit, source: 'survey_question_flow' });
      toast(`${bName(q.benefit)} 설문 완료 · 500P 적립`);
    }
    if (index + 1 < qs.length) {
      F.surveyIndex = index + 1;
      renderForm(); focusTitle();
    } else {
      F.submitted = true;
      if (needsPhotos('outfitcode')) openPhotos('survey_complete');
      else {
        view = 'done'; $('#sheet-title').textContent = '설문 완료';
        body.innerHTML = '<div class="done"><img class="done-point-art" src="assets/coin-p-front.webp" alt="" /><p class="done__title">설문 완료</p></div>';
        foot.innerHTML = '<button type="button" class="btn btn--ink btn--xl" data-done-close>완료</button>';
        focusTitle();
      }
    }
  }

  function goStep(n) {
    F.step = n;
    F.maxStep = STEP_KEYS[n - 1];
    renderForm();
    focusTitle();
    A.track('apply_step_view', { step: F.maxStep, apply_type: applyType(selList()) });
  }

  function focusFirstError(keys) {
    const k = keys[0];
    const el = k === 'pick' ? $('#p-' + BENEFITS.find(canApply))
      : k.startsWith('consent_') ? $('#c-' + k.slice(8))
      : k.startsWith('q_') ? $(`[data-answer="${k.slice(2)}"]`) : $('#f-' + k);
    if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
    toast(`확인이 필요한 항목이 ${keys.length}개 있어요.`);
  }

  function validateStep(n) {
    F.errors = {};
    if (n === 1) {
      if (!F.selected.size) F.errors.pick = '받을 혜택을 하나 이상 골라 주세요.';
      neededFields().forEach((k) => { const e = validateField(k); if (e) F.errors[k] = e; });
    }
    if (n === 2) {
      visibleConsents().forEach((id) => { if (C.consents[id].required && !F.consents[id]) F.errors['consent_' + id] = '혜택을 받으려면 꼭 필요한 동의예요.'; });
    }
    const keys = Object.keys(F.errors);
    keys.forEach((k) => A.track('apply_validation_error', { field: k, step: STEP_KEYS[n - 1] }));
    return keys;
  }

  // 폼 이벤트(위임)
  $('#sheet').addEventListener('change', (e) => {
    if (view !== 'form') return;
    const t = e.target;
    if (t.dataset.pick) {
      const b = t.dataset.pick;
      t.checked ? F.selected.add(b) : F.selected.delete(b);
      delete F.errors.pick;
      A.track('apply_selection_change', { benefit: b, action: t.checked ? 'add' : 'remove', benefits: selList().join(','), selected_count: F.selected.size, apply_type: F.selected.size ? applyType(selList()) : 'none' });
      renderForm();
      $('#p-' + b).focus();
    } else if (t.dataset.consent) {
      const id = t.dataset.consent;
      F.consents[id] = t.checked;
      delete F.errors['consent_' + id];
      A.track('consent_change', { consent_id: id, checked: t.checked });
      renderForm();
      $('#c-' + id).focus();
    } else if (t.hasAttribute('data-consent-all')) {
      visibleConsents().forEach((id) => { F.consents[id] = t.checked; delete F.errors['consent_' + id]; });
      A.track('consent_all_change', { checked: t.checked });
      renderForm();
      $('#c-all').focus();
    } else if (t.dataset.answer && t.type === 'radio') {
      F.answers[t.dataset.answer] = t.value;
      delete F.errors['q_' + t.dataset.answer];
      A.track('survey_answer', { field: t.dataset.answer });
      updateSurveyFoot();
    } else if (t.dataset.field) {
      const k = t.dataset.field;
      F[k] = t.value.trim();
      const err = validateField(k);
      if (!err && !F.completed.has(k)) { F.completed.add(k); A.track('apply_field_complete', { field: k }); }
      if (F.errors[k]) { if (err) F.errors[k] = err; else delete F.errors[k]; renderForm(); $('#f-' + k).focus(); }
    }
  });
  body.addEventListener('input', (e) => {
    const t = e.target;
    if (view !== 'form') return;
    if (t.dataset.field) { F[t.dataset.field] = t.value.trim(); F.touched.add(t.dataset.field); }
    if (t.dataset.answer && t.tagName === 'TEXTAREA') { F.answers[t.dataset.answer] = t.value; updateSurveyFoot(); }
  });
  body.addEventListener('click', (e) => {
    const d = e.target.closest('[data-detail]');
    if (d && view === 'form') {
      const id = d.dataset.detail;
      if (F.open.has(id)) F.open.delete(id); else { F.open.add(id); A.track('consent_detail_view', { consent_id: id }); }
      renderForm();
      $(`[data-detail="${id}"]`).focus();
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add && view === 'form') {
      const b = add.dataset.add;
      F.selected.add(b);
      A.track('apply_selection_change', { benefit: b, action: 'add', source: 'nudge', benefits: selList().join(','), selected_count: F.selected.size, apply_type: applyType(selList()) });
      renderForm();
      $('#p-' + b).focus();
    }
  });
  foot.addEventListener('click', (e) => {
    if (view === 'form') {
      if (e.target.closest('#step-next')) {
        const errs = validateStep(F.step);
        if (errs.length) { renderForm(); focusFirstError(errs); return; }
        goStep(F.step + 1); return;
      }
      if (e.target.closest('#step-back')) { F.errors = {}; goStep(F.step - 1); return; }
      if (e.target.closest('#step-skip')) { F.skippedSurvey = true; A.track('survey_skip', {}); goStep(3); return; }
      if (e.target.closest('#submit-btn')) { submit(); return; }
      if (e.target.closest('#survey-submit')) { submitLater(); return; }
    }
    if (e.target.closest('[data-done-close]')) { closeSheet(); scrollToId('my-benefits'); }
    if (e.target.closest('[data-status-close]')) closeSheet();
  });

  function validateField(k) {
    const f = C.fields[k];
    const v = F[k];
    if (!v) return { realname: '실명을', height: '키를', weight: '몸무게를', email: '이메일을' }[k] + ' 입력해 주세요.';
    if (f.unit) {
      const n = Number(v);
      if (!/^\d{2,3}(\.\d)?$/.test(v) || isNaN(n)) return `${f.label}는 숫자로 입력해 주세요. 예) ${k === 'height' ? '165' : '60'}`;
      if (n < f.min || n > f.max) return `${f.label}를 다시 확인해 주세요. (${f.min}~${f.max}${f.unit})`;
    }
    if (k === 'email') {
      const e = v.trim().toLowerCase();
      if (!/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(e)) return '이메일 주소 형식을 확인해 주세요. 예) hong@naver.com';
      if (/@(example|test|invalid|localhost)\.|@example$|^example@email\.com$/.test(e) || e === (C.member.email || '').toLowerCase()) return '예시 주소예요. 리포트를 실제로 받으실 이메일을 입력해 주세요.';
    }
    if (k === 'realname' && v.length < 2) return '실명을 다시 확인해 주세요.';
    return '';
  }

  function validate() {
    const all = [];
    [1, 2].forEach((n) => { if (!all.length) { const e = validateStep(n); if (e.length) { all.push(...e); F.step = n; } } });
    return all;
  }

  function submit() {
    if (F.submitting) return;
    F.failed = false;
    const errs = validate();
    const sel = selList();
    if (errs.length) { renderForm(); focusFirstError(errs); return; }
    F.submitting = true;
    renderForm();
    A.track('apply_submit', { apply_type: applyType(sel), benefits: sel.join(','), selected_count: sel.length, checked: !!F.consents.onyu_marketing });

    // 실제 서비스에서는 여기서 서버 API 호출 (이번 프로토타입은 전송하지 않음)
    setTimeout(() => {
      F.submitting = false;
      if (proto.failNext) {
        proto.failNext = false;
        renderProto();
        F.failed = true;
        A.track('apply_result', { result: 'fail', error_code: 'SIMULATED_NETWORK', apply_type: applyType(sel), benefits: sel.join(',') });
        renderForm();
        const b = $('#submit-error'); if (b) { body.scrollTop = 0; b.focus(); }
        return;
      }
      F.submitted = true;
      sel.forEach((b) => { S.status[b] = C.photos.requiredBy.includes(b) ? 'photos_needed' : 'applied'; });
      S.survey = S.survey || {};
      F.earnedPoints = false;
      save();
      A.track('apply_result', { result: 'success', apply_type: applyType(sel), benefits: sel.join(','), duration_ms: Date.now() - F.startedAt });
      updateCtas();
      renderDone(sel);
    }, 1100);
  }

  function trackAbandon(reason) {
    A.track('apply_abandon', {
      step: F.maxStep, source: reason, apply_type: F.selected.size ? applyType(selList()) : 'none',
      filled_count: neededFields().filter((k) => F[k]).length, required_count: neededFields().length,
      duration_ms: Date.now() - F.startedAt,
    });
  }
  window.addEventListener('pagehide', () => { if (!root.hidden && view === 'form' && F && !F.submitted) trackAbandon('pagehide'); });

  /* ---------------- 완료 화면 ---------------- */
  function renderDone(sel) {
    view = 'done';
    $('#sheet-title').textContent = '신청 완료';
    const pending = surveyPendingBenefits();
    const photo = needsPhotos('outfitcode');
    body.innerHTML = `<div class="done">${pending.length ? '<img class="done-point-art" src="assets/coin-p-front.webp" alt="" />' : ''}<p class="done__title" role="status">신청 완료</p>
      ${pending.length ? `<p class="done__sub">설문에 참여하고 ${ptsFmt(pending.length)}를 받으세요.</p>` : photo ? '<p class="done__sub">아웃핏코드 사진을 등록해 주세요.</p>' : ''}</div>`;
    foot.innerHTML = pending.length
      ? '<button type="button" class="btn btn--ink btn--xl" data-cta="done_survey_later" data-survey-later>설문 참여</button>'
      : photo ? '<button type="button" class="btn btn--ink btn--xl" data-cta="done_photos" data-photos>사진 등록</button>'
      : '<button type="button" class="btn btn--ink btn--xl" data-done-close>완료</button>';
    focusTitle();
    A.track('apply_complete_view', { benefits: sel.join(','), apply_type: applyType(sel) });
  }

  /* ---------------- 아웃핏코드 사진 제출 ---------------- */
  let P = null;
  const GUIDE = {
    face: '<svg viewBox="0 0 80 96" aria-hidden="true"><ellipse cx="40" cy="40" rx="22" ry="28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="5 4"/><path d="M14 94 c4-18 14-24 26-24 s22 6 26 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="5 4"/></svg>',
    body: '<svg viewBox="0 0 80 96" aria-hidden="true"><circle cx="40" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4 3"/><path d="M26 26 h28 l4 34 h-8 l-2 34 h-7 l-1-26 -1 26 h-7 l-2-34 h-8 z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="5 4" stroke-linejoin="round"/></svg>',
  };

  function openPhotos(source) {
    if (P) ['face', 'body'].forEach((k) => P[k] && URL.revokeObjectURL(P[k].url));
    P = { face: null, body: null, errors: {}, submitting: false, submitted: false, source };
    view = 'photos';
    openSheet();
    renderPhotos();
    focusTitle();
    A.track('photo_flow_start', { source });
  }

  function renderPhotos() {
    $('#sheet-title').textContent = '사진 올리기';
    const slot = (it) => {
      const f = P[it.key];
      const err = P.errors[it.key];
      return `<div class="pslot ${f ? 'has-file' : ''} ${err ? 'is-error' : ''}">
        <label class="pslot__box" for="ph-${it.key}">
          ${f ? `<img src="${f.url}" alt="선택한 ${esc(it.label)}" />` : `<img src="assets/photo-guide-${it.key}.png" alt="${esc(it.label)} 예시" />`}
          <span class="pslot__camera" aria-hidden="true"><svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h4l2-3h4l2 3h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/></svg></span>
          <input type="file" aria-label="${esc(it.label)} 등록 또는 변경" id="ph-${it.key}" data-photo="${it.key}" accept="image/*" aria-describedby="ph-${it.key}-tip${err ? ` ph-${it.key}-err` : ''}" />
        </label>
        <p class="pslot__name">${esc(it.label)}</p>
        <p class="pslot__tip" id="ph-${it.key}-tip">${esc(it.tip)}</p>

        ${err ? `<span class="err" id="ph-${it.key}-err">${err}</span>` : ''}
      </div>`;
    };
    body.innerHTML = `
      <p class="fblock__why" style="margin-top:0">얼굴형과 체형에 맞는 스타일을 찾는 데 꼭 필요해요. 2장만 올리면 아웃핏코드 신청이 끝나요.</p>
      <div class="pslots">${C.photos.items.map(slot).join('')}</div>
      <ul class="ptips">
        <li>밝은 곳에서 정면을 보고 찍어 주세요</li>
        <li>모자·선글라스는 벗어 주세요</li>
        <li>전신 사진은 머리부터 발끝까지 나오게 찍어 주세요</li>
      </ul>
      <p class="note" style="margin:14px 0 0">사진은 스타일 분석에만 쓰이고, 광고나 외부 공개에는 쓰이지 않아요. 보관 기간: ${cfgHTML(C.photos.retention)}</p>`;
    const n = ['face', 'body'].filter((k) => P[k]).length;
    foot.innerHTML = `<p class="foot-hint">${n}/2장 선택됨</p>
      <button type="button" class="btn btn--oc btn--xl" id="photo-submit" ${P.submitting ? 'disabled aria-busy="true"' : ''}>${P.submitting ? '올리고 있어요…' : '사진 올리고 신청 끝내기'}</button>`;
  }

  body.addEventListener('change', (e) => {
    const t = e.target;
    if (view !== 'photos' || !t.dataset.photo) return;
    const k = t.dataset.photo;
    const file = t.files && t.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { P.errors[k] = '사진 파일만 올릴 수 있어요.'; }
    else if (file.size > C.photos.maxMB * 1024 * 1024) { P.errors[k] = `${C.photos.maxMB}MB 이하 사진을 올려 주세요.`; }
    else {
      if (P[k]) URL.revokeObjectURL(P[k].url);
      P[k] = { url: URL.createObjectURL(file) }; // 미리보기만 — 이번 프로토타입은 서버로 보내지 않아요
      delete P.errors[k];
      A.track('photo_selected', { field: k });
    }
    renderPhotos();
    $('#ph-' + k).focus();
  }, true);

  foot.addEventListener('click', (e) => {
    if (!e.target.closest('#photo-submit') || view !== 'photos' || P.submitting) return;
    P.errors = {};
    C.photos.items.forEach((it) => { if (!P[it.key]) P.errors[it.key] = `${it.label}을 올려 주세요.`; });
    const errs = Object.keys(P.errors);
    if (errs.length) { renderPhotos(); $('#ph-' + errs[0]).focus(); toast(`사진 ${errs.length}장이 더 필요해요.`); return; }
    P.submitting = true; renderPhotos();
    A.track('photo_submit', { filled_count: 2 });
    setTimeout(() => {
      P.submitting = false; P.submitted = true;
      S.status.outfitcode = 'applied'; save();
      A.track('photo_result', { result: 'success' });
      updateCtas();
      renderPhotoDone();
    }, 1100);
  });

  function renderPhotoDone() {
    view = 'done';
    $('#sheet-title').textContent = '신청 완료';
    const up = BENEFITS.find(canApply);
    body.innerHTML = `<div class="done">
      <div class="done__stamp" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M12 25 l8 8 l17 -18" stroke="#1D1530" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <p class="done__title" role="status">아웃핏코드 신청이<br />끝났어요!</p>
      <p class="done__sub">리포트가 준비되면 입력하신 이메일로 보내 드려요.</p>
      <div class="done__list">${statusCard('outfitcode', 'photo_done')}</div>
      ${up ? `<div class="upsell upsell--${up}"><p class="upsell__k">아직 받지 않은 혜택 · ${bName(up)}</p><p class="upsell__t">월 납입금 없는 상조 가입도<br />무료로 함께 받아보세요</p><button type="button" class="btn" data-cta="photo_done_upsell_${up}" data-apply="${up}">${bName(up)}도 신청하기</button></div>` : ''}
    </div>`;
    foot.innerHTML = `<button type="button" class="btn btn--ink btn--xl" data-done-close>확인</button>`;
    focusTitle();
  }

  /* ---------------- 내 혜택 현황 시트 ---------------- */
  function openStatus(source) {
    view = 'status';
    openSheet();
    $('#sheet-title').textContent = '나의 혜택';
    body.innerHTML = `<p class="status__hint" style="margin-top:0">‘신청 완료’는 시놀이 접수했다는 뜻이에요. 가입과 리포트 발송은 각 회사 확인 후 진행돼요.</p>
      <div class="board">${pointsHTML()}${BENEFITS.map((b) => statusCard(b, 'status_sheet')).join('')}</div>`;
    foot.innerHTML = `<button type="button" class="btn btn--ghost btn--xl" data-status-close>닫기</button>`;
    focusTitle();
    A.track('status_view', { source, status: BENEFITS.map((b) => `${b}:${S.status[b]}`).join('|') });
  }

  /* ---------------- CTA 위임 ---------------- */
  function sectionOf(el) {
    if (el.closest('#sheet')) return 'sheet';
    if (el.closest('.topbar')) return 'header';
    if (el.closest('#sticky-cta')) return 'sticky';
    const s = el.closest('[data-section]');
    return s ? s.dataset.section : 'unknown';
  }
  function scrollToId(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const h = el.querySelector('h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-cta]');
    if (!el) return;
    const cta = el.dataset.cta;
    const loc = sectionOf(el);
    const t = el.dataset.apply;

    if (t) {
      e.preventDefault();
      // choose: '원하는 혜택만 받기' — 아무것도 미리 고르지 않은 채 신청 창을 열어 직접 선택
      const list = t === 'bundle' ? remaining() : t === 'choose' ? [] : [t];
      if (t !== 'bundle' && t !== 'choose' && needsPhotos(t)) {
        A.track('cta_click', { cta_id: cta, cta_location: loc, apply_type: t, action: 'open_photos' });
        openPhotos(cta); return;
      }
      const ok = t === 'bundle' ? list.length > 0 : t === 'choose' ? remaining().length > 0 : canApply(t);
      A.track('cta_click', { cta_id: cta, cta_location: loc, apply_type: ok ? applyType(list) : t, action: ok ? 'open_apply' : 'open_status' });
      if (!ok) { openStatus(cta); return; }
      if (!root.hidden && view !== 'form') { // 시트 안에서 다른 신청으로 전환
        F = newForm(list, cta); view = 'form'; renderForm(); focusTitle();
        A.track('apply_start', { cta_id: cta, apply_type: applyType(list), benefits: list.join(','), selected_count: list.length });
      } else {
        openApply(list, cta);
      }
      return;
    }
    A.track('cta_click', { cta_id: cta, cta_location: loc });
    if (el.hasAttribute('data-photos')) { openPhotos(cta); return; }
    if (el.hasAttribute('data-survey-later')) {
      if (!root.hidden) { root.hidden = true; document.body.classList.remove('is-locked'); outside().forEach((x) => x && x.removeAttribute('inert')); view = null; }
      openSurveyLater(cta); return;
    }
    if (el.dataset.open === 'status') { openStatus(cta); return; }
    if (el.dataset.scroll) { e.preventDefault(); scrollToId(el.dataset.scroll); return; }
    if (el.hasAttribute('data-edit-profile')) {
      const link = C.links.editProfile;
      toast(link.value ? '회원정보 수정 화면으로 이동해요.' : '회원정보 수정 화면으로 이동해요. (연결 경로 확인 필요)');
      return;
    }
    if (el.hasAttribute('data-contact')) {
      const cc = C.links.customerCenter;
      // 카카오톡 채널 1:1 채팅 링크가 있으면 바로 새 창으로 연결
      if (cc.chatUrl) { e.preventDefault(); window.open(cc.chatUrl, '_blank', 'noopener'); return; }
      toast('카카오톡 채널 1:1 채팅 링크를 연결하기 전이에요. 카카오톡에서 ‘시놀’ 채널을 찾아 문의해 주세요.');
    }
  });

  /* ---------------- 하단 고정 CTA ---------------- */
  const sticky = $('#sticky-cta');
  const stickyBtn = $('button', sticky);
  const vis = { hero: true, all: false };
  function updateSticky() {
    const show = root.hidden && !Object.keys(vis).some((k) => vis[k]); // 다른 신청 버튼이 화면에 보이면 숨겨 겹침 방지
    sticky.classList.toggle('is-visible', show);
    sticky.setAttribute('aria-hidden', String(!show));
    stickyBtn.tabIndex = show ? 0 : -1;
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((ents) => {
      ents.forEach((en) => { vis[en.target.dataset.stickyWatch] = en.isIntersecting; });
      updateSticky();
    });
    const h = $('.hero__cta'); h.dataset.stickyWatch = 'hero'; io.observe(h);
    const a = $('.all__body'); a.dataset.stickyWatch = 'all'; io.observe(a);
    document.querySelectorAll('main .cta-row').forEach((r, i) => { r.dataset.stickyWatch = 'row' + i; io.observe(r); });

    // 섹션 노출
    const seen = new Set();
    const so = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        const id = en.target.dataset.section;
        if (en.isIntersecting && !seen.has(id)) { seen.add(id); A.track('section_view', { section_id: id }); }
      });
    }, { threshold: 0.35 });
    $$('[data-section]').forEach((s) => so.observe(s));
  } else {
    vis.hero = false; updateSticky();
  }

  // 기획전 탭 — 현재 섹션 표시
  if ('IntersectionObserver' in window) {
    const tabs = $$('.tabs a');
    const to = new IntersectionObserver((ents) => {
      ents.forEach((en) => {
        if (!en.isIntersecting) return;
        tabs.forEach((t) => {
          const on = t.dataset.tab === en.target.id;
          t.classList.toggle('is-on', on);
          if (on) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    tabs.forEach((t) => { const sec = document.getElementById(t.dataset.tab); if (sec) to.observe(sec); });
  }

  // FAQ 열람
  $$('#faq-list details').forEach((d) => d.addEventListener('toggle', () => { if (d.open) A.track('faq_open', { section_id: 'faq', field: d.dataset.faq }); }));

  /* ---------------- 프로토타입 테스트 도구 ---------------- */
  const protoRoot = $('#proto');
  const log = [];
  A.onEvent((p) => {
    log.unshift(p);
    if (log.length > 30) log.pop();
    const box = $('#proto-log');
    if (box) box.textContent = log.map((x) => JSON.stringify(x)).join('\n');
  });

  function renderProto() {
    const opts = (b) => Object.keys(STATUS).map((k) => `<option value="${k}" ${S.status[b] === k ? 'selected' : ''}>${STATUS[k].label}</option>`).join('');
    $('#proto-body').innerHTML = `
      <p class="proto__h">혜택 상태 (서버·제휴사 처리 결과 시뮬레이션)</p>
      ${BENEFITS.map((b) => `<label>${bName(b)}<select data-proto-status="${b}">${opts(b)}</select></label>`).join('')}
      <div class="row"><input type="checkbox" id="pf-fail" ${proto.failNext ? 'checked' : ''}/><label for="pf-fail" style="margin:0">다음 신청 1회 실패시키기</label></div>
      <div class="row"><input type="checkbox" id="pf-tbd" ${document.body.classList.contains('hide-tbd') ? '' : 'checked'}/><label for="pf-tbd" style="margin:0">확인 필요 항목 강조</label></div>
      <button type="button" class="btn btn--ink" id="pf-reset">처음 상태로 초기화</button>
      <p class="proto__h">분석 이벤트 (dataLayer · 최근 30개)</p>
      <div class="proto__log" id="proto-log">${esc(log.map((x) => JSON.stringify(x)).join('\n'))}</div>`;
  }
  $('#proto-open').addEventListener('click', () => { protoRoot.hidden = !protoRoot.hidden; if (!protoRoot.hidden) { renderProto(); $('#proto-close').focus(); } });
  $('#proto-close').addEventListener('click', () => { protoRoot.hidden = true; $('#proto-open').focus(); });
  protoRoot.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.protoStatus) {
      const b = t.dataset.protoStatus; const from = S.status[b]; const to = t.value;
      S.status[b] = to; save();
      A.track('benefit_status_change', { benefit: b, from_status: from, to_status: to, source: 'server_simulated' });
      if (to === 'delivered') A.track('benefit_fulfilled', { benefit: b, source: 'server_simulated' });
      updateCtas();
      if (view === 'status') openStatus('proto_refresh');
    }
    if (t.id === 'pf-fail') proto.failNext = t.checked;
    if (t.id === 'pf-tbd') document.body.classList.toggle('hide-tbd', !t.checked);
  });
  protoRoot.addEventListener('click', (e) => {
    if (e.target.id === 'pf-reset') {
      S = defaultState(); save(); proto.failNext = false;
      updateCtas(); renderProto(); toast('처음 상태로 돌아왔어요.');
    }
  });

  /* ---------------- 시작 ---------------- */
  bindStatic();
  updateCtas();
  updateSticky();
  if (BENEFITS.every((b) => !canApply(b)) && surveyPendingBenefits().length) {
    openSheet();
    renderDone(BENEFITS);
    $('#sheet-title').textContent = '미완료 설문';
  }
  A.track('benefit_page_view', { status: BENEFITS.map((b) => `${b}:${S.status[b]}`).join('|') });
})();
