const home = new URL('https://web.sinor.co.kr/silovematch/');
const eventList = new URL('../events/', import.meta.url);
const logo = new URL('../../assets/silovematch-event-wordmark.png', import.meta.url);
const links = [
  ['1:1 매칭', new URL('#programs', home)],
  ['단체미팅', new URL('#meetings', home)],
  ['이벤트', eventList],
  ['FAQ', new URL('#faq', home)],
];

export function mountSilovematchHeader(header, {homeUrl = home, eventsUrl = eventList} = {}) {
  if (!header || header.querySelector('.silovematch-header-inner')) return;
  const homepage = new URL(homeUrl, location.href);
  header.classList.add('silovematch-header');
  header.innerHTML = `
    <div class="silovematch-header-inner">
      <a class="silovematch-header-brand"><img width="2297" height="440" alt="시럽인연 홈"></a>
      <button type="button" class="silovematch-nav-toggle" aria-controls="silovematch-navigation" aria-expanded="false" aria-label="메뉴 열기">
        <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
      </button>
      <nav id="silovematch-navigation" class="silovematch-navigation" aria-label="시럽인연 메뉴"></nav>
    </div>`;
  const brand = header.querySelector('.silovematch-header-brand');
  brand.href = homepage.href;
  brand.querySelector('img').src = logo.href;
  const nav = header.querySelector('nav');
  const toggle = header.querySelector('button');

  for (const [label, destination] of links) {
    const link = document.createElement('a');
    const target = destination === eventList ? new URL(eventsUrl, location.href) : new URL(destination.hash, homepage);
    const samePage = target.origin === location.origin &&
      target.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '') && target.hash;
    link.href = samePage ? target.hash : target.href;
    const eventsPath = target.pathname.replace(/\/$/, '');
    if (destination === eventList && target.origin === location.origin &&
        (location.pathname.replace(/\/$/, '') === eventsPath || location.pathname.startsWith(eventsPath + '/'))) {
      link.setAttribute('aria-current', 'location');
    }
    link.textContent = label;
    nav.append(link);
  }

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  }
  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  toggle.onclick = () => setOpen(!isOpen());
  nav.onclick = event => {
    if (!event.target.closest('a')) return;
    if (isOpen()) toggle.focus();
    setOpen(false);
  };
  document.addEventListener('click', event => {
    if (isOpen() && !header.contains(event.target)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });
  matchMedia('(max-width: 767px)').addEventListener('change', () => setOpen(false));
}
