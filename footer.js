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
