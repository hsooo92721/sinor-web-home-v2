import {eventCodeFrame} from '../cms/event-code-frame.js';
import {installCodeEditor} from './code-editor.js?v=5';
import {el, button, formModal} from './forms-ui.js?v=1';
import {eventFormFrame, fitEventFrame} from '../cms/event-form-frame.js';
import {events, saveEvent, eventDemo, eventPublication, eventUrl, duplicateEvent, deleteEvent} from '../cms/events.js?v=9';
import {formsCms} from '../cms/form-store.js?v=9';
import {columnEditor} from './column-editor.js?v=inline-layout-3';
import {siteUrl} from '../cms/client.js?v=26';

export async function eventsAdmin(root, toast) {
  root.innerHTML = `
    <header class="content-head"><h1>이벤트 관리</h1></header>
    <p>이벤트를 등록하고 공개 상태를 관리하세요.</p>
    ${eventDemo ? '<p>작업용 모드 · 이 브라우저에서만 변경사항을 확인할 수 있습니다.</p>' : ''}
    <p><button class="button primary" type="button" data-add>+ 이벤트 등록</button>
    <a class="button" href="${siteUrl('silovematch/events/')}">이벤트 목록 보기</a></p>
    <section hidden data-detail-preview>
      <div class="page-head"><button class="button" type="button" data-preview-back>이벤트 목록</button><button class="button primary" type="button" data-preview-edit>수정</button></div>
      <div data-preview-content></div>
    </section>
    <section hidden data-editor-page aria-labelledby="event-editor-title">
      <header><h2 id="event-editor-title" data-editor-title></h2><button class="popup-modal-close" type="button" data-close aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></header>
      <form data-editor>
      <div class="panel studio-metadata">
      <label>제목 <input class="input" name="title" required maxlength="120"></label>
      <label>이벤트 URL <input class="input" name="slug" maxlength="80" placeholder="november-promotion"><small data-event-url></small></label>
      <label>301 리디렉션 기존 URL <textarea class="input" name="legacyUrls" rows="2" placeholder="이전 주소를 한 줄에 하나씩 입력"></textarea></label>
      <div class="event-editor-columns">
        <section aria-label="이벤트 콘텐츠">
      <div class="event-editor-period">
        <label>이벤트 기간 <select class="select" name="period"><option value="dates">직접 선택</option><option value="ongoing">상시 모집</option></select></label>
        <label data-date>시작일 <input class="input" name="start" type="date"></label>
        <label data-date>종료일 <input class="input" name="end" type="date"></label>
      </div>
      <div style="display:flex;align-items:end;gap:12px;flex-wrap:wrap">
        <label>대표이미지 <input class="input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-image></label>
        <img data-image-preview hidden alt="대표 이미지 미리보기" style="width:80px;height:52px;object-fit:contain;border-radius:8px">
        <button class="button small" type="button" data-remove-image hidden>이미지 제거</button>
      </div>

      <label>공개 상태 <select class="select" name="published"><option value="false">비공개</option><option value="true">공개</option><option value="scheduled">예약</option></select></label>
      <label data-reservation>게시 예약 일시 (한국 시간) <input class="input" type="datetime-local" name="publishAt"></label>
          <h3>상세 내용</h3>
          <label>작성 방식 <select class="select" name="contentMode"><option value="visual">비주얼 · HTML/CSS</option><option value="code">HTML·CSS·JS</option></select></label>
          <div data-event-studio></div>
          <section data-event-code hidden>
            <textarea data-event-source aria-label="HTML CSS JavaScript 코드" hidden></textarea>
            <button class="button" type="button" data-run-code>실행 미리보기</button>
            <div data-code-preview></div>
          </section>
        </section>
        <section aria-label="연동 폼">
      <label>입력폼 <select class="select" name="formId"><option value="">입력폼 선택 안 함</option></select></label>
          <div data-form-preview></div>
        </section>
      </div>
      <footer class="event-editor-actions">
        <div class="actions"><button class="button" type="button" data-cancel>취소</button><button class="button primary" type="submit">저장</button></div>
      </footer>
      </div>
      </form>
    </section>
    <div data-events style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:16px"></div>`;
  const dialog = root.querySelector('[data-editor-page]');
  const form = root.querySelector('form');
  const list = root.querySelector('[data-events]');
  let selected;
  let image;
  const preview = form.querySelector('[data-image-preview]');
  const upload = form.querySelector('[data-image]');
  const removeImage = form.querySelector('[data-remove-image]');
  function setImage(value) {
    image = value;
    if (value) preview.src = value;
    else preview.removeAttribute('src');
    preview.hidden = removeImage.hidden = !value;
  }
  let previewUrl;
  upload.onchange = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = upload.files[0] ? URL.createObjectURL(upload.files[0]) : undefined;
    if (previewUrl) {
      preview.src = previewUrl;
      preview.hidden = removeImage.hidden = false;
    } else setImage(image);
  };
  removeImage.onclick = () => { upload.value = ''; upload.onchange(); setImage(''); editor.setCover(''); };
  function syncPublication() {
    const scheduled = form.elements.published.value === 'scheduled';
    form.elements.publishAt.required = scheduled;
    form.elements.publishAt.closest('label').style.display = scheduled ? 'grid' : 'none';
  }
  form.elements.published.onchange = syncPublication;
  const detailPreview = root.querySelector('[data-detail-preview]');
  const previewContent = detailPreview.querySelector('[data-preview-content]');
  const listControls = Array.from(root.children).filter(node => node !== dialog && node !== detailPreview);
  function showEditor(open) {
    detailPreview.hidden = true;
    previewContent.replaceChildren();
    dialog.hidden = !open;
    if (!open) stopCode();
    for (const node of listControls) node.hidden = open;
    if (!open) {
      selected = undefined;
      formPreview.replaceChildren();
    }
  }
  function showPreview(event) {
    showEditor(false);
    for (const node of listControls) node.hidden = true;
    detailPreview.hidden = false;
    detailPreview.querySelector('[data-preview-edit]').onclick = () => edit(event);
    const url = new URL(siteUrl('silovematch/events/view/'));
    url.searchParams.set('id', event.id);
    url.searchParams.set('preview', '1');
    const frame = el('iframe', {class:'event-form', title:event.title, src:url.href});
    fitEventFrame(frame);
    previewContent.replaceChildren(frame);
    detailPreview.querySelector('[data-preview-back]').focus();
  }
  detailPreview.querySelector('[data-preview-back]').onclick = () => showEditor(false);
  function showUrl() {
    const slug = form.elements.slug.value.trim().toLowerCase();
    form.querySelector('[data-event-url]').textContent = slug || selected
      ? eventUrl({slug, id: selected?.id}) : '';
  }
  form.elements.slug.oninput = showUrl;
  const editor = await columnEditor(form.querySelector('[data-event-studio]'), toast, {
    onCover(value) {
      upload.value = '';
      upload.onchange();
      setImage(value);
    },
  });
  const codePanel = form.querySelector('[data-event-code]');
  const codeSource = form.querySelector('[data-event-source]');
  const codeEditor = installCodeEditor(codeSource);
  codeEditor.frame.querySelector('.code-editor-bar > span').textContent = '〈/〉 HTML · CSS · JS';
  const codePreview = form.querySelector('[data-code-preview]');
  let runningCode;
  function stopCode() { runningCode?.dispose(); runningCode = null; codePreview.replaceChildren(); }
  function runCode() {
    stopCode();
    if (form.elements.contentMode.value !== 'code') return;
    runningCode = eventCodeFrame(codeSource.value, '이벤트 코드 미리보기');
    codePreview.append(runningCode);
  }
  function syncContentMode() {
    const isCode = form.elements.contentMode.value === 'code';
    form.querySelector('[data-event-studio]').hidden = isCode;
    codePanel.hidden = !isCode;
    codeEditor.show(isCode);
    if (isCode) runCode(); else stopCode();
  }
  form.elements.contentMode.onchange = syncContentMode;
  form.querySelector('[data-run-code]').onclick = runCode;
  function syncFields() {
    const dated = form.elements.period.value === 'dates';
    for (const input of form.querySelectorAll('[data-date] input')) {
      input.disabled = !dated;
      input.closest('label').style.display = dated ? 'grid' : 'none';
    }
  }
  form.elements.period.onchange = syncFields;
  const formSelect = form.elements.formId;
  const formPreview = form.querySelector('[data-form-preview]');
  let availableForms = [];
  let editVersion = 0;
  function drawFormPreview() {
    formPreview.replaceChildren();
    const entry = availableForms.find(item => item.id === formSelect.value);
    if (entry?.active) formPreview.append(eventFormFrame(entry, {preview: true}));
    else if (formSelect.value) formPreview.textContent = '미리 볼 수 없는 입력폼입니다.';
  }
  formSelect.onchange = drawFormPreview;

  async function edit(event) {
    const version = ++editVersion;
    availableForms = [];
    formPreview.replaceChildren();
    selected = event;
    form.reset();
    upload.onchange();
    editor.reset(event || {});
    codeSource.value = event?.codeDocument || '';
    codeEditor.sync();
    formSelect.length = 1;
    if (event?.formId && !Array.from(formSelect.options).some(option => option.value === event.formId)) {
      formSelect.add(new Option('기존 입력폼 · 확인 필요', event.formId));
    }
    for (const input of form.elements) {
      if (input.name && event?.[input.name] != null) input.value = Array.isArray(event[input.name]) ? event[input.name].join('\n') : event[input.name];
    }
    setImage(event?.image || '');
    if (event?.published && event.publishAt) form.elements.published.value = 'scheduled';
    syncContentMode();
    showUrl();
    syncPublication();
    syncFields();
    dialog.querySelector('[data-editor-title]').textContent = event ? '이벤트 수정' : '이벤트 등록';
    showEditor(true);
    form.elements.title.focus();
    try {
      const entries = await formsCms.list();
      if (dialog.hidden || version !== editVersion) return;
      availableForms = entries;
      for (const entry of entries) {
        const existing = Array.from(formSelect.options).find(option => option.value === entry.id);
        const name = entry.name || entry.id;
        if (existing) existing.textContent = name;
        else {
          const option = new Option(name, entry.id);
          option.disabled = !entry.active;
          formSelect.add(option);
        }
      }
      drawFormPreview();
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function render() {
    const records = await events(true);
    list.replaceChildren();
    if (!records.length) list.textContent = '등록된 이벤트가 없습니다.';
    for (const event of records) {
      const row = document.createElement('article');
      row.className = 'panel';
      row.style.cssText = 'padding:0;overflow:hidden';
      const cover = document.createElement('div');
      cover.style.cssText = 'aspect-ratio:1;overflow:hidden;position:relative;display:grid;place-items:center;background:#f4f6f8;color:#667085';
      if (event.image) {
        const thumbnail = document.createElement('img');
        thumbnail.src = event.image;
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';
        thumbnail.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover';
        cover.append(thumbnail);
      } else cover.textContent = '대표이미지 없음';
      const details = document.createElement('div');
      details.style.cssText = 'padding:16px;display:grid;gap:8px;overflow-wrap:anywhere';
      const period = document.createElement('div');
      period.textContent = event.period === 'ongoing' ? '상시 모집'
        : [event.start, event.end].filter(Boolean).join(' ~ ') || '기간 미정';
      const title = document.createElement('strong');
      title.textContent = event.title;
      const status = eventPublication(event);
      const badge = el('span', {class:'event-status', dataset:{status}}, status);
      cover.append(badge);
      const open = button('', () => showPreview(event), 'event-card-open');
      open.setAttribute('aria-label', event.title + ' 미리보기');
      open.append(cover, title, period);
      const actions = el('div', {class:'event-card-actions'});
      const duplicate = button('복제', async () => {
        duplicate.disabled = true;
        try {
          await duplicateEvent(event);
          await render();
          toast('이벤트를 복제했습니다.');
        } catch (error) {
          toast(error.message, true);
        } finally {
          duplicate.disabled = false;
        }
      }, 'button small');
      const remove = button('삭제', () => {
        const modal = formModal('정말 삭제하시겠습니까?', {saveLabel:'삭제'});
        modal.body.append(el('p', {}, event.title));
        modal.save.onclick = async () => {
          modal.save.disabled = true;
          try {
            await deleteEvent(event.id);
            modal.dialog.close();
            await render();
            toast('이벤트를 삭제했습니다.');
          } catch (error) {
            toast(error.message, true);
          } finally {
            modal.save.disabled = false;
          }
        };
      }, 'button small danger');
      actions.append(duplicate, button('수정', () => edit(event), 'button small'), remove);
      details.append(actions);
      row.append(open, details);
      list.append(row);
    }
  }

  root.querySelector('[data-add]').onclick = () => edit();
  form.querySelector('[data-cancel]').onclick = () => showEditor(false);
  dialog.querySelector('[data-close]').onclick = () => showEditor(false);
  form.onsubmit = async event => {
    if (event.target !== form) return;
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const file = upload.files[0];
      if (file && (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type))) {
        throw new Error('JPG, PNG, WebP 또는 GIF 한 장을 첨부해 주세요.');
      }
      if (file) {
        const result = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
          reader.readAsDataURL(file);
        });
        setImage(result);
      }
      const values = Object.fromEntries(new FormData(form));
      await saveEvent({schedule: selected?.schedule, location: selected?.location, start: '', end: '', apply: '', ...values, image, publishAt: values.published === 'scheduled' ? values.publishAt : '', ...editor.read(), contentMode: values.contentMode, codeDocument: codeSource.value, id: selected?.id, published: values.published !== 'false'});
      showEditor(false);
      await render();
      toast('이벤트를 저장했습니다.');
    } catch (error) {
      toast(error.message);
    } finally {
      submit.disabled = false;
    }
  };
  await render();
}
