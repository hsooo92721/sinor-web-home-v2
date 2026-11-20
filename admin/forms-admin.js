import {renderForm} from '../cms/form-renderer.js?v=7';
import {openFormUrlSettings,publicFormUrl} from './form-url-settings.js?v=7';
import {formsCms} from '../cms/form-store.js?v=9';
import {openFormBuilder} from './form-builder.js?v=14';
import {openFormIntegration} from './form-integration.js?v=3';
import {formModal,el,E} from './forms-ui.js?v=1';
export async function formsAdmin(root,toast){
 let forms=await formsCms.list(),selected=forms[0]?.id,preview;
 root.innerHTML='<div class="page-head"><div><h1>입력폼</h1><p>입력폼을 만들고 관리합니다.</p></div><button class="button primary" data-new-form><i class="fa-solid fa-plus"></i> 양식추가</button></div><div class="forms-admin-layout"><aside class="panel forms-library"><header class="forms-library-heading"><strong>입력폼 목록</strong><span data-form-total></span></header><div data-forms-list></div></aside><section class="panel forms-submissions"><header><div><h2 data-form-title></h2><small data-form-id></small></div><div class="forms-selected-actions"><button class="button small" data-current-edit><i class="fa-solid fa-pen"></i> 양식 편집</button><button class="button small" data-current-url><i class="fa-solid fa-link"></i> 주소 설정</button><button class="button small" data-current-integration><i class="fa-solid fa-plug"></i> 슬랙 연동</button></div></header><div data-entries></div></section></div>';
 const list=root.querySelector('[data-forms-list]'),results=root.querySelector('[data-entries]');
 function drawList(){root.querySelector('[data-form-total]').textContent=forms.length+'개';list.innerHTML=forms.map(f=>'<div class="forms-library-row '+(f.id===selected?'active':'')+'" data-form-row="'+E(f.id)+'"><button type="button" data-select-form="'+E(f.id)+'"><strong>'+E(f.name)+'</strong><small>'+f.fields.filter(f=>!['heading','paragraph'].includes(f.type)).length+'개 항목 · '+(f.active?'사용 중':'사용 안 함')+'</small></button><div class="forms-library-more"><button type="button" aria-label="'+E(f.name)+' 메뉴"><i class="fa-solid fa-ellipsis-vertical" aria-hidden="true"></i></button><div><button type="button" data-integrate="'+E(f.id)+'">연동</button><button type="button" data-edit-form="'+E(f.id)+'">수정</button><button type="button" data-delete-form="'+E(f.id)+'">삭제</button></div></div></div>').join('')||'<div class="empty">양식을 추가해 주세요.</div>'}
 function load(){
  const form=forms.find(item=>item.id===selected);
  root.querySelector('[data-form-title]').textContent=form?.name||'입력폼 선택';
  root.querySelector('[data-form-id]').textContent=form?publicFormUrl(form):'';
  root.querySelectorAll('.forms-selected-actions button').forEach(button=>button.disabled=!form);
  preview?.destroy();
  results.replaceChildren();
  preview=form?renderForm(results,form,{preview:true,embedded:true}):undefined;
 }
 async function saved(form){forms=await formsCms.list();selected=form.id;drawList();await load()}
 root.querySelector('[data-new-form]').onclick=()=>openFormBuilder(null,{onSave:saved,toast});root.querySelector('[data-current-edit]').onclick=()=>openFormBuilder(forms.find(f=>f.id===selected),{onSave:saved,toast});root.querySelector('[data-current-url]').onclick=()=>openFormUrlSettings(forms.find(f=>f.id===selected),{onSave:saved,toast});root.querySelector('[data-current-integration]').onclick=()=>openFormIntegration(forms.find(f=>f.id===selected),toast);
 list.onclick=e=>{const choose=e.target.closest('[data-select-form]'),edit=e.target.closest('[data-edit-form]'),integration=e.target.closest('[data-integrate]'),remove=e.target.closest('[data-delete-form]');if(choose){selected=choose.dataset.selectForm;drawList();load()}if(edit)openFormBuilder(forms.find(f=>f.id===edit.dataset.editForm),{onSave:saved,toast});if(integration)openFormIntegration(forms.find(f=>f.id===integration.dataset.integrate),toast);if(remove){const form=forms.find(f=>f.id===remove.dataset.deleteForm),m=formModal('양식을 삭제하시겠습니까?',{saveLabel:'확인'});m.body.append(el('p',{},form.name),el('p',{class:'help'},'신규 신청에 사용할 수 없게 됩니다. 기존 접수 기록은 보존합니다.'),el('p',{class:'form-error',role:'alert'}));m.save.onclick=async()=>{m.save.disabled=true;try{await formsCms.remove(form.id);forms=await formsCms.list();if(selected===form.id)selected=forms[0]?.id;m.dialog.close();drawList();await load();toast('양식을 삭제했습니다.')}catch(e){m.body.querySelector('[role=alert]').textContent=e.message;m.save.disabled=false}}}};
 drawList();await load();
}
