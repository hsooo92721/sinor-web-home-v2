import {siteUrl} from './client.js?v=26';
import {formSlug} from './form-urls.js?v=1';

export function eventFormFrame(form, {preview = false} = {}) {
  const frame = document.createElement('iframe');
  frame.className = 'event-form';
  frame.title = form.name || '이벤트 신청폼';
  frame.src = siteUrl('forms/?slug=' + encodeURIComponent(formSlug(form)) +
    '&embedded=1' + (preview ? '&preview=1' : ''));
  fitEventFrame(frame);
  return frame;
}

export function fitEventFrame(frame) {
  let observer;
  frame.addEventListener('load', () => {
    observer?.disconnect();
    const body = frame.contentDocument?.body;
    if (!body) return;
    const resize = () => { frame.style.height = Math.ceil(body.getBoundingClientRect().height) + 'px'; };
    observer = new ResizeObserver(resize);
    observer.observe(body);
    resize();
  });
}
