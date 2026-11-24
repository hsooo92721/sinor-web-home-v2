import {publishedEvents} from './published-data.js';
import {sanitizeHtml, siteUrl} from './client.js?v=inline-layout-3';

const key = 'sinor-cms-events';
const config = window.SINOR_CMS_CONFIG;
export const eventDemo = config?.mode !== 'api';

let database;
function openDatabase() {
  return database ??= new Promise((resolve, reject) => {
    const legacy = JSON.parse(localStorage.getItem(key) || '[]');
    const open = indexedDB.open(key + ':' + new URL('../', import.meta.url).pathname, 1);
    open.onupgradeneeded = () => {
      const store = open.result.createObjectStore('events', {keyPath: 'id'});
      for (const event of legacy) store.put(event);
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

async function eventStorage(method, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('events', ['put', 'delete'].includes(method) ? 'readwrite' : 'readonly');
    const request = transaction.objectStore('events')[method](value);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error || new Error('이벤트 저장을 완료하지 못했습니다.'));
  });
}

async function request(path, options) {
  const response = await fetch(config.apiBase.replace(/\/$/, '') + path, {
    cache: 'no-store', credentials: config.credentials || 'same-origin',
    headers: {'Content-Type': 'application/json'}, ...options,
  });
  if (!response.ok) throw new Error('이벤트 데이터를 처리하지 못했습니다.');
  return response.status === 204 ? null : response.json();
}

export function eventLink(value) {
  if (!value) return '';
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('전체 HTTP 또는 HTTPS 주소를 입력해 주세요.');
  return url.href;
}

function publicationTime(value) {
  return Date.parse(value + ':00+09:00');
}

export async function events(admin = false) {
  const records = eventDemo ? [...new Map([...(await publishedEvents), ...(await eventStorage('getAll'))].map(event => [event.id, event])).values()]
    : await request(admin ? '/admin/events' : '/events');
  return records.filter(event => !event.deleted && (admin || (event.published && (!event.publishAt || publicationTime(event.publishAt) <= Date.now()))))
    .map(event => ({...event,
      image: event.image && !/^(?:https?:|data:)/.test(event.image) ? siteUrl(event.image) : event.image,
      bodyHtml: event.bodyHtml?.replace(/src="(assets\/[^"]+)"/g, (_, path) => 'src="' + siteUrl(path) + '"'),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function eventUrl(event) {
  if (event.slug) return siteUrl('silovematch/events/' + encodeURIComponent(event.slug));
  const url = new URL(siteUrl('silovematch/events/'));
  url.searchParams.set('id', event.id);
  return url.href;
}

export function eventPublication(event) {
  if (!event.published) return '비공개';
  return event.publishAt && publicationTime(event.publishAt) > Date.now() ? '예약' : '공개';
}

function legacyKey(value) {
  if (!/^(?:https?:\/\/|\/(?!\/))/i.test(value)) throw new Error('이전 주소는 전체 URL 또는 /로 시작하는 경로로 입력해 주세요.');
  const url = new URL(value, siteUrl(''));
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('이전 주소는 HTTP 또는 HTTPS URL이나 /로 시작하는 경로를 입력해 주세요.');
  }
  return url.pathname.replace(/\/$/, '') + url.search;
}

export function eventRedirect(records, address) {
  const key = legacyKey(address);
  return records.find(event => (event.legacyUrls || []).some(url => legacyKey(url) === key));
}

export async function deleteEvent(id) {
  if (eventDemo) return eventStorage('put', {id, deleted:true});
  await request('/admin/events/' + encodeURIComponent(id), {method: 'DELETE'});
}

export async function duplicateEvent(event) {
  const records = await events(true);
  const titles = new Set(records.map(item => item.title));
  const base = event.title.replace(/\s*\(\d{1,3}\)$/, '');
  for (let number = 1; number <= 999; number++) {
    const suffix = ' (' + number + ')';
    const title = base.slice(0, 120 - suffix.length) + suffix;
    if (!titles.has(title)) return saveEvent({...event, id: '', title, slug: '', legacyUrls: [], published: false, publishAt: ''});
  }
  throw new Error('같은 제목의 복제본이 999개 있습니다.');
}

export async function saveEvent(input) {
  const title = input.title.trim();
  if (!title) throw new Error('제목을 입력해 주세요.');
  if (input.start && input.end && input.start > input.end) throw new Error('신청 종료일은 시작일 이후로 선택해 주세요.');
  if (input.publishAt && !Number.isFinite(publicationTime(input.publishAt))) throw new Error('게시 예약 일시를 확인해 주세요.');
  const records = await events(true);
  const previous = records.find(item => item.id === input.id);
  const slug = String(input.slug || '').trim().toLowerCase();
  if (slug && !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug) || slug.length > 80 || slug === 'view') throw new Error('이벤트 URL은 영문 소문자, 숫자, 하이픈, 밑줄으로 입력해 주세요.');
  if (slug && records.some(item => item.id !== input.id && (item.slug === slug || (item.legacyUrls || []).some(url => legacyKey(url) === legacyKey(eventUrl({slug})))))) throw new Error('이미 사용 중인 이벤트 URL입니다.');
  const legacyUrls = [...new Set((Array.isArray(input.legacyUrls) ? input.legacyUrls : String(input.legacyUrls || '').split(/\r?\n/)).map(url => url.trim()).filter(Boolean))];
  if (previous && previous.slug !== slug) {
    legacyUrls.push(eventUrl(previous));
    if (previous.slug) {
      const oldQuery = new URL(siteUrl('silovematch/events/'));
      oldQuery.searchParams.set('e', previous.slug);
      legacyUrls.push(oldQuery.href);
    }
    if (!previous.slug) {
      const detail = new URL(siteUrl('silovematch/events/view/'));
      detail.searchParams.set('id', previous.id);
      legacyUrls.push(detail.href);
    }
  }
  const keys = legacyUrls.map(legacyKey);
  for (const item of records) {
    const routes = [legacyKey(eventUrl(item)), ...(item.legacyUrls || []).map(legacyKey)];
    if (item.id !== input.id && keys.some(key => routes.includes(key))) throw new Error('다른 이벤트에서 사용 중인 이전 주소입니다.');
  }
  const canonical = legacyKey(eventUrl({slug, id: input.id || ''}));
  const redirects = legacyUrls.filter((url, index) => keys[index] !== canonical && keys.indexOf(keys[index]) === index);
  const image = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(input.image) ? input.image : eventLink(input.image);
  const event = {
    ...input, contentMode: input.contentMode === 'code' ? 'code' : 'visual', codeDocument: String(input.codeDocument || ''), title, slug, legacyUrls: redirects, id: input.id || crypto.randomUUID(),
    ...(input.bodyHtml != null ? {bodyHtml: sanitizeHtml(input.bodyHtml)} : {}),
    image, apply: eventLink(input.apply),
    updatedAt: new Date().toISOString(),
  };
  if (!eventDemo) return request('/admin/events/' + encodeURIComponent(event.id), {
    method: 'PUT', body: JSON.stringify(event),
  });
  await eventStorage('put', event);
  return event;
}

export function eventStatus(event) {
  if (event.period === 'ongoing') return '상시 모집';
  const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Seoul'}).format(new Date());
  if (event.start && today < event.start) return '신청 예정';
  if (event.end && today > event.end) return '신청 마감';
  return event.apply || event.formId ? '접수 중' : '이벤트 안내';
}
