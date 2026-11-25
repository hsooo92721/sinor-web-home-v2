/*
 * 분석 이벤트 — GA4(dataLayer) 연동을 위한 구조
 * ------------------------------------------------------------
 * - 모든 이벤트는 window.dataLayer 로 push 돼요(GTM/GA4가 붙으면 그대로 수집).
 * - 허용된 키(ALLOWED)만 통과시켜 개인정보 원문(이름·전화·이메일·키·몸무게)이
 *   이벤트에 섞이지 않도록 막아요.
 * - CTA는 위치별 cta_id 로 구분돼요. (README.md 이벤트 표 참고)
 */
(function () {
  const ALLOWED = new Set([
    'cta_id', 'cta_location', 'apply_type', 'benefits', 'section_id', 'benefit',
    'action', 'field', 'step', 'consent_id', 'checked', 'result', 'error_code',
    'status', 'from_status', 'to_status', 'filled_count', 'required_count',
    'source', 'entry', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
    'referrer_host', 'selected_count', 'open_source', 'duration_ms',
  ]);

  const params = new URLSearchParams(location.search);
  let referrerHost = '';
  try { referrerHost = document.referrer ? new URL(document.referrer).host : ''; } catch (e) { /* noop */ }

  const context = {
    page_id: 'sinor_benefit_v1',
    entry: params.get('entry') || 'direct',
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    utm_content: params.get('utm_content') || undefined,
    referrer_host: referrerHost || undefined,
  };

  const listeners = [];
  window.dataLayer = window.dataLayer || [];

  function sanitize(obj) {
    const out = {};
    Object.keys(obj || {}).forEach((k) => {
      if (!ALLOWED.has(k)) return;
      const v = obj[k];
      if (v === undefined || v === null || v === '') return;
      if (typeof v === 'string' && /@|\d{3}-?\d{3,4}-?\d{4}/.test(v)) return; // 이메일·전화 형태 차단
      out[k] = v;
    });
    return out;
  }

  function track(event, data) {
    const payload = Object.assign({ event }, sanitize(context), sanitize(data), { ts: Date.now() });
    window.dataLayer.push(payload);
    listeners.forEach((fn) => { try { fn(payload); } catch (e) { /* noop */ } });
    return payload;
  }

  window.SinorAnalytics = {
    track,
    context,
    onEvent(fn) { listeners.push(fn); },
  };
})();
