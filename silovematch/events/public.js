import {eventCodeFrame} from '../../cms/event-code-frame.js?v=2';
import {mountSilovematchHeader} from '../shared/header.js?v=2';
import {setColumnCss} from '../../cms/column-css.js';
import {events, eventLink, eventStatus, eventUrl, eventRedirect} from '../../cms/events.js?v=9';

import {sanitizeHtml} from '../../cms/client.js?v=inline-layout-3';
import {formsCms} from '../../cms/form-store.js?v=9';
import {eventFormFrame} from '../../cms/event-form-frame.js';

const main = document.querySelector('main');
const base = new URL('./', import.meta.url);
const params = new URLSearchParams(location.search);
const id = params.get('id') || window.SINOR_PAGE_ROUTE?.contentId;
const pathSlug = (window.SINOR_PAGE_ROUTE?.originalPath || location.pathname).slice(base.pathname.length).match(/^([a-z0-9]+(?:[-_][a-z0-9]+)*)\/?$/)?.[1];
const slug = params.get('e') || (pathSlug !== 'view' ? pathSlug : null);
const preview = document.body.dataset.detail !== undefined && params.get('preview') === '1';
const header = document.querySelector('[data-silovematch-header]');
if (preview) {
  header?.remove();
  document.querySelector('.app-footer')?.remove();
} else {
  mountSilovematchHeader(header);
}

function element(tag, text) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  return node;
}

function eventImage(event) {
  const image = element('img');
  image.src = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(event.image) ? event.image : eventLink(event.image);
  image.alt = '';
  return image;
}

function periodLabel(event) {
  if (event.period === 'ongoing') return '상시 모집';
  if (event.start && event.end) return event.start + ' ~ ' + event.end;
  if (event.start) return event.start + '부터';
  if (event.end) return event.end + '까지';
  return event.schedule || '기간 미정';
}

function installMobileApplication(form) {
  const trigger = element('button', form.template === 'casting' ? '출연 신청하기' : '상담 신청하기');
  trigger.type = 'button';
  trigger.className = 'event-mobile-apply';
  trigger.setAttribute('aria-haspopup', 'dialog');

  const dialog = element('dialog');
  dialog.className = 'event-mobile-form';
  dialog.setAttribute('aria-labelledby', 'event-mobile-form-title');
  const bar = element('div');
  bar.className = 'event-mobile-form-bar';
  const back = element('button', '←');
  back.type = 'button';
  back.setAttribute('aria-label', '이벤트 상세로 돌아가기');
  const heading = element('strong', form.name || '이벤트 신청');
  heading.id = 'event-mobile-form-title';
  bar.append(back, heading);
  const content = element('div');
  content.className = 'event-mobile-form-content';
  dialog.append(bar, content);

  trigger.onclick = () => {
    if (!content.firstElementChild) content.append(eventFormFrame(form));
    document.body.classList.add('event-form-open');
    dialog.showModal();
    back.focus();
  };
  back.onclick = () => dialog.close();
  dialog.onclose = () => {
    document.body.classList.remove('event-form-open');
    if (trigger.getClientRects().length) trigger.focus({preventScroll:true});
  };
  matchMedia('(max-width:767px)').addEventListener('change', event => {
    if (!event.matches && dialog.open) dialog.close();
  });
  document.body.classList.add('event-has-mobile-apply');
  document.body.append(trigger, dialog);
}

async function render() {
  const records = await events(preview);
  if (!preview) {
    const redirect = eventRedirect(records, location.href);
    if (redirect && new URL(eventUrl(redirect)).href !== location.href) {
      location.replace(eventUrl(redirect));
      return;
    }
  }
  if (document.body.dataset.detail !== undefined || slug || id) {
    const event = records.find(item => slug ? item.slug === slug : item.id === id);
    if (!event) {
      main.textContent = '현재 볼 수 있는 이벤트가 없습니다.';
      return;
    }
    if (!preview && params.has('e') && event.slug) {
      location.replace(eventUrl(event));
      return;
    }
    const status = eventStatus(event);
    document.title = event.title + ' · 시럽인연';
    const layout = element('div');
    layout.className = 'event-detail';
    const article = element('article');
    article.className = 'event-article';
    const title = element('h1', event.title);
    layout.append(article);
    const period = element('p', '이벤트 기간 · ' + periodLabel(event));
    main.replaceChildren(title, period, layout);
    if (!preview) {
      const back = element('a');
      back.className = 'event-back-link';
      back.href = base.href;
      const arrow = element('span', '←');
      arrow.setAttribute('aria-hidden', 'true');
      back.append(arrow, '이벤트 목록');
      main.prepend(back);
    }
    if (status !== '접수 중') article.append(element('small', status));
    if (event.image) article.append(eventImage(event));
    if (event.schedule) article.append(element('p', '일정 · ' + event.schedule));
    if (event.location) article.append(element('p', '장소 · ' + event.location));
    const description = element('div');
    description.className = 'description sinor-column';
    if (event.contentMode === 'code') description.append(eventCodeFrame(event.codeDocument || '', event.title));
    else if (event.bodyHtml) description.innerHTML = sanitizeHtml(event.bodyHtml);
    else {
      description.classList.add('is-plain-text');
      description.textContent = event.description || '';
    }
    article.append(description);
    setColumnCss(event.customCss || '', 'event-detail-css', '.event-article > .description.sinor-column');
    const accepting = status === '접수 중' || status === '상시 모집';
    if ((accepting || preview) && event.formId) {
      const application = element('section');
      application.className = 'event-application';
      application.setAttribute('aria-label', '신청폼');
      layout.append(application);
      layout.classList.add('has-form');
      const form = await formsCms.get(event.formId).catch(() => null);
      if (!form?.active) {
        application.append(element('p', '현재 사용할 수 없는 신청폼입니다.'));
        return;
      }
      application.append(eventFormFrame(form, {preview}));
      if (!preview) installMobileApplication(form);
    }
    return;
  }

  main.replaceChildren(element('h1', '이벤트'));
  if (!records.length) main.append(element('p', '공개된 이벤트가 없습니다.'));
  const grid = element('div');
  grid.className = 'grid';
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(records.length / pageSize));
  const requested = Number(new URLSearchParams(location.search).get('page'));
  const page = Number.isSafeInteger(requested) ? Math.min(pages, Math.max(1, requested)) : 1;
  for (const event of records.slice((page - 1) * pageSize, page * pageSize)) {
    const card = element('a');
    card.className = 'silovematch-card';
    card.href = eventUrl(event);
    const thumbnail = event.image ? eventImage(event) : element('span');
    thumbnail.className = 'silovematch-card-thumbnail';
    if (event.image) thumbnail.loading = 'lazy';
    const title = element('h2', event.title);
    title.className = 'silovematch-card-title';
    title.title = event.title;
    const period = element('p', periodLabel(event));
    period.className = 'silovematch-card-metadata';
    const footer = element('div');
    footer.className = 'silovematch-card-footer';
    const status = eventStatus(event);
    const ended = status === '신청 마감';
    const action = element('span', ended ? '종료' : status === '신청 예정' ? '진행 예정' : '신청하기');
    action.className = 'silovematch-card-action' + (ended ? ' is-ended' : '');
    footer.append(action);
    card.append(thumbnail, title, period, footer);
    grid.append(card);
  }
  main.append(grid);
  if (pages > 1) {
    const pagination = element('nav');
    pagination.className = 'event-pagination';
    pagination.setAttribute('aria-label', '이벤트 목록 페이지');
    for (let number = 1; number <= pages; number++) {
      const link = element('a', String(number));
      const url = new URL(location.href);
      if (number === 1) url.searchParams.delete('page');
      else url.searchParams.set('page', number);
      link.href = url.href;
      if (number === page) link.setAttribute('aria-current', 'page');
      pagination.append(link);
    }
    main.append(pagination);
  }
}

render().catch(() => { main.textContent = '이벤트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'; });
