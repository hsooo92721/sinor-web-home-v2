// Shared native details behavior, including keyboard activation.
document.querySelectorAll('.app-footer .company-info').forEach(details => {
  details.addEventListener('toggle', () => {
    window.dispatchEvent(new Event('scroll'));
    if (!details.open) return;
    requestAnimationFrame(() => window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    }));
  });
});
// Shared site settings also cover article pages outside the managed page router.
import(new URL('cms/site-settings-public.js?v=1',document.currentScript.src).href).catch(error=>console.warn('사이트 설정을 불러오지 못했습니다.',error));
