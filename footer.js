const footerScriptUrl = document.currentScript.src;
const footerTemplateUrl = new URL('components/footer.html', footerScriptUrl);
const siteRootUrl = new URL('.', footerScriptUrl);

async function mountSharedFooter() {
  const footer = document.querySelector('[data-shared-footer]');
  if (!footer) return;

  const response = await fetch(footerTemplateUrl, { cache: 'no-cache' });
  if (!response.ok) throw new Error('공통 푸터를 불러오지 못했습니다.');
  const documentFragment = new DOMParser().parseFromString(await response.text(), 'text/html');
  const template = documentFragment.querySelector('.app-footer');
  if (!template) throw new Error('공통 푸터가 비어 있습니다.');

  for (const element of template.querySelectorAll('[href], [src]')) {
    for (const attribute of ['href', 'src']) {
      if (element.hasAttribute(attribute)) {
        element.setAttribute(attribute, new URL(element.getAttribute(attribute), footerTemplateUrl).href);
      }
    }
    if (element.matches('a') && !footer.hasAttribute('data-footer-new-tab') &&
        element.href.startsWith(siteRootUrl.href)) {
      element.removeAttribute('target');
      element.removeAttribute('rel');
    }
  }

  footer.dataset.figmaNode = template.dataset.figmaNode;
  footer.replaceChildren(...template.childNodes);
  footer.querySelector('.company-info')?.addEventListener('toggle', event => {
    window.dispatchEvent(new Event('scroll'));
    if (!event.currentTarget.open) return;
    requestAnimationFrame(() => window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    }));
  });
  window.dispatchEvent(new Event('scroll'));
}

mountSharedFooter()
  .catch(error => console.warn(error))
  .then(() => import(new URL('cms/site-settings-public.js?v=4', footerScriptUrl).href))
  .catch(error => console.warn('사이트 설정을 불러오지 못했습니다.', error));
