import {formsCms} from '../cms/form-store.js?v=9';
import {pageDropPlan} from './page-tree-drop.js?v=1';
import {events as readEvents} from '../cms/events.js?v=9';
import {el,input,select,label,button,check,formModal,E} from './forms-ui.js?v=1';
import {loadPages,pageOperation,pageState,parentPath,publicUrl,uploadPageBundle,pageBundleDownload} from '../cms/page-management.js';
const types={page:'일반 페이지',landing:'랜딩페이지',policy:'약관·정책',system:'시스템',dynamic:'동적 경로',group:'폴더',planned:'개발 예정',external:'외부 링크'};
const icon=name=>el('i',{class:'fa-solid fa-'+name,'aria-hidden':'true'});
const clean=path=>path==='/'?'/':path.replace(/\/$/,'');
function parentPicker(items,value){
 const host=el('div',{class:'page-parent-picker'}),trigger=button('',()=>toggle(!open),'page-parent-trigger'),list=el('div',{class:'page-parent-options',role:'listbox','aria-label':'상위 페이지 목록',hidden:true});
 trigger.setAttribute('role','combobox');trigger.setAttribute('aria-label','상위 페이지');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
 let selected=value,open=false,current=0;const options=[];
 function caption(item){return el('span',{class:'page-parent-caption'},el('strong',{},item.name),el('small',{},item.path))}
 function paint(){const item=items.find(x=>x.id===selected)||items[0];trigger.replaceChildren(caption(item),icon('chevron-down'));for(const option of options){const chosen=option.dataset.value===selected;option.setAttribute('aria-selected',String(chosen));option.classList.toggle('is-chosen',chosen)}}
 function outside(e){if(!host.contains(e.target))toggle(false)}
 function toggle(value){if(trigger.disabled)return;open=value;list.hidden=!open;trigger.setAttribute('aria-expanded',String(open));if(open){current=Math.max(0,items.findIndex(x=>x.id===selected));options[current]?.focus();document.addEventListener('pointerdown',outside)}else document.removeEventListener('pointerdown',outside)}
 for(const item of items){const option=button('',()=>{selected=item.id;paint();toggle(false);trigger.focus();host.onchange?.(new Event('change'))},'page-parent-option');option.dataset.value=item.id;option.setAttribute('role','option');option.tabIndex=-1;option.append(caption(item),el('i',{class:'fa-solid fa-check','aria-hidden':'true'}));options.push(option);list.append(option)}
 host.onkeydown=e=>{if(e.key==='Escape'){toggle(false);trigger.focus();e.preventDefault()}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();if(!open)toggle(true);else{current=e.key==='Home'?0:e.key==='End'?options.length-1:(current+(e.key==='ArrowDown'?1:options.length-1))%options.length;options[current]?.focus()}}};
 Object.defineProperty(host,'value',{get:()=>selected,set:value=>{selected=value;paint()}});Object.defineProperty(host,'disabled',{get:()=>trigger.disabled,set:value=>{trigger.disabled=!!value;toggle(false)}});
 host.append(trigger,list);paint();return host;
}
export async function pagesAdmin(root,toast){
 let state=await loadPages(),settingsTab='basic',tabPageId=null,query='',folded=new Set(),dragging,selectedId=null,settingsHost;
 const banner=document.querySelector('.mode-banner span');if(banner)banner.textContent=state.backend==='static'?'페이지 목록 조회 · 운영 서버 미연결':'페이지 운영 서버 연결됨 · 변경사항이 로컬 서버에 저장됩니다.';
 const active=()=>state.pages.filter(p=>!p.removed&&p.path!=='/404.html'&&!p.redirectTarget&&(p.source!=='silovematch/events/view/index.html'||p.contentKind==='event'));
 async function refresh(){state=await loadPages();await syncEvents();await syncForms();render()}
 async function syncEvents(){if(state.backend==='static')return;const records=await readEvents(true);if(records.some(e=>!state.pages.some(p=>p.contentId===e.id&&p.contentTitle===e.title&&p.contentPublished===!!e.published))){await pageOperation({kind:'sync-events',records:records.map(e=>({id:e.id,title:e.title,slug:e.slug,published:e.published}))});state=pageState()}}
 async function syncForms(){if(state.backend==='static')return;const forms=await formsCms.list();if(forms.some(f=>!state.pages.some(p=>p.contentKind==='form'&&p.contentId===f.id&&p.contentTitle===f.name&&p.contentPublished===!!f.active))){await pageOperation({kind:'sync-forms',records:forms.map(f=>({id:f.id,name:f.name,slug:f.slug||f.id,active:f.active}))});state=pageState()}}
 await syncEvents();await syncForms();
 const connected=()=>state.backend!=='static';
 function fail(error,modal){if(modal){let box=modal.body.querySelector('.page-modal-error');if(!box){box=el('p',{class:'page-modal-error',role:'alert'});modal.body.append(box)}box.textContent=error.message}else toast(error.message,true)}
 function safe(action){return async()=>{try{await action()}catch(e){fail(e)}}}
 async function commit(operation,origin){
   const plan=await pageOperation(operation,true);
   if(plan.changes.length){
     const modal=formModal('URL 변경 확인',{saveLabel:'변경 적용'});modal.dialog.classList.add('page-settings-panel');
     modal.body.append(el('p',{},'아래 페이지의 주소가 함께 변경됩니다.'),changeList(plan.changes));
     let redirect=operation.redirect!==false;
     if(operation.kind!=='restore')modal.body.append(check('기존 URL에서 HTTP 301 리디렉션 생성',redirect,v=>redirect=v));
     modal.save.onclick=async()=>{modal.save.disabled=true;try{await pageOperation({...operation,redirect});modal.dialog.close();origin?.dialog.close();await refresh();toast('페이지 설정을 저장했습니다.')}catch(e){fail(e,modal)}finally{modal.save.disabled=false}};
   }else{const result=await pageOperation(operation);if(operation.kind==='save'&&!operation.id)selectedId=result.pages.find(p=>!state.pages.some(old=>old.id===p.id))?.id||selectedId;origin?.dialog.close();await refresh();toast('페이지 설정을 저장했습니다.')}
 }
 function changeList(items){return el('div',{class:'page-change-list'},items.map(x=>el('div',{},el('strong',{},x.name),el('del',{},x.from),el('ins',{},x.to))))}
 function heading(){return el('div',{class:'page-head'},el('div',{},el('h1',{},'페이지 관리'),el('p',{},'페이지 이름, 제목, 메뉴와 주소를 관리하세요.')),el('div',{class:'actions'},button('페이지 추가',()=>settings(), 'button primary')))}
 function render(){
   root.replaceChildren(heading());
   if(!connected())root.append(el('p',{class:'page-status-note',role:'status'},'페이지 목록 조회 중 · URL 변경, HTTP 리디렉션 및 SEO 저장은 페이지 운영 서버 연결 후 사용할 수 있습니다.'));
   drawTree();
 }
 function drawTree(){
   const pages=active();
   const layout=el('div',{class:'pages-workspace'}),library=el('aside',{class:'pages-library panel','aria-label':'페이지 구조'});
   settingsHost=el('section',{class:'pages-detail','aria-label':'선택 페이지 설정'});layout.append(library,settingsHost);
   library.append(el('div',{class:'page-library-heading'},el('strong',{},'페이지 구조'),button('+',()=>settings(), 'page-library-add')));
   const container=el('div',{class:'pages-tree',role:'tree','aria-label':'페이지 계층 목록'});library.append(container);root.append(layout);
   const selected=pages.find(p=>p.id===selectedId)||pages.find(p=>p.path==='/')||pages[0];selectedId=selected?.id||null;
   drawRows(container);if(selected)settings(selected,true);else settingsHost.append(el('p',{class:'pages-empty'},'페이지를 선택해 주세요.'));
 }
 function drawRows(container){
   const pages=active(),matches=new Set();const term=query.trim().toLowerCase();
   for(const p of pages)if(!term||(p.name+' '+p.path).toLowerCase().includes(term)){matches.add(p.id);let path=parentPath(p.path);while(path){const parent=pages.find(q=>q.path===path);if(parent)matches.add(parent.id);if(path==='/')break;path=parentPath(path)}}
   container.replaceChildren();
   const sorted=list=>list.sort((a,b)=>Number(a.order||0)-Number(b.order||0)||a.path.localeCompare(b.path));
   function add(p,depth){
     if(!matches.has(p.id))return;
     const children=sorted(pages.filter(c=>c.id!==p.id&&parentPath(c.path)===p.path));
     const row=el('div',{class:'page-tree-row'+(p.id===selectedId?' is-selected':''),role:'treeitem','aria-level':depth+1,draggable:false,dataset:{pageId:p.id}});
     row.style.setProperty('--depth',depth);row.style.setProperty('--page-name-size',depth>1?'14px':'16px');
     const expand=button('',()=>{if(folded.has(p.id))folded.delete(p.id);else folded.add(p.id);drawRows(container)},'page-expander');expand.setAttribute('aria-label',p.name+' '+(folded.has(p.id)?'펼치기':'접기'));expand.setAttribute('aria-expanded',String(!folded.has(p.id)));expand.disabled=!children.length;expand.append(icon('chevron-down'));expand.classList.toggle('is-folded',folded.has(p.id));
     const name=button('',()=>{selectedId=p.id;drawRows(container);settings(p,true)},'page-select');name.setAttribute('aria-pressed',String(p.id===selectedId));name.title=p.name;name.append(el('strong',{},p.type==='group'&&p.name===p.path?p.path.replace(/^\/+|\/+$/g,'').split('/').pop():p.name));
     const remove=button('',()=>confirmRemove(p),'page-tree-delete');remove.title='삭제';remove.setAttribute('aria-label',p.name+' 삭제');remove.append(icon('trash-can'));remove.disabled=!!p.protected;
     const plus=button('',()=>settings(null,false,p),'page-tree-add');plus.append(icon('plus'));plus.title='하위 페이지 또는 폴더 추가';plus.setAttribute('aria-label',p.name+' 하위 추가');
     plus.disabled=p.type==='dynamic'||!p.path.endsWith('/');
     const controls=el('div',{class:'page-row-controls'},plus,remove);
     row.append(el('div',{class:'page-tree-main'},el('span',{class:'page-grip','aria-label':p.name+' 드래그하여 이동'},p.protected?null:icon('grip-vertical')),expand,p.type==='group'?icon('folder'):null,name),controls);
     row.onclick=e=>{if(e.target.closest('button,a,.page-grip'))return;selectedId=p.id;drawRows(container);settings(p,true)};
     const grip=row.querySelector('.page-grip');
     if(!p.protected){let startPoint=null,ghost=null,plan=null,scrollFrame=0,pointerX=0,pointerY=0;
       const clearFeedback=()=>{for(const target of container.querySelectorAll('[data-drop]')){delete target.dataset.drop;delete target.dataset.dropLabel}container.classList.remove('is-dragging')};
       const end=()=>{startPoint=null;plan=null;ghost?.remove();ghost=null;clearFeedback();cancelAnimationFrame(scrollFrame);row.classList.remove('is-drag-source');document.removeEventListener('keydown',escape);};
       const escape=e=>{if(e.key==='Escape')end()};
       const track=(x,y)=>{
         clearFeedback();container.classList.add('is-dragging');
         const hit=document.elementFromPoint(x,y)?.closest('.page-tree-row');
         const target=active().find(q=>q.id===hit?.dataset.pageId);
         plan=target?pageDropPlan(active(),p.id,target.id,(y-hit.getBoundingClientRect().top)/hit.getBoundingClientRect().height):null;
         if(plan){let marker=hit;if(plan.zone==='after'){let next=hit.nextElementSibling;while(next&&Number(next.getAttribute('aria-level'))>Number(hit.getAttribute('aria-level'))){marker=next;next=next.nextElementSibling}}
           marker.dataset.drop=plan.zone;marker.dataset.dropLabel=plan.label;
         }
         if(ghost){ghost.style.left=(x+16)+'px';ghost.style.top=(y+16)+'px';ghost.querySelector('small').textContent=plan?.label||'이 위치로 이동할 수 없습니다.';ghost.classList.toggle('is-invalid',!plan)}
       };
       const autoScroll=()=>{if(!ghost)return;const delta=pointerY<72?-10:pointerY>innerHeight-72?10:0;if(delta){window.scrollBy(0,delta);track(pointerX,pointerY);}scrollFrame=requestAnimationFrame(autoScroll)};
       grip.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();grip.setPointerCapture(e.pointerId);startPoint={x:e.clientX,y:e.clientY};document.addEventListener('keydown',escape)};
       grip.onpointermove=e=>{if(!startPoint)return;pointerX=e.clientX;pointerY=e.clientY;
         if(!ghost&&Math.hypot(e.clientX-startPoint.x,e.clientY-startPoint.y)>5){ghost=el('div',{class:'page-drag-preview'},el('strong',{},icon('grip-vertical'),p.name),el('small',{},''));document.body.append(ghost);row.classList.add('is-drag-source');scrollFrame=requestAnimationFrame(autoScroll)}
         if(ghost){e.preventDefault();track(e.clientX,e.clientY)}
       };
       grip.onpointerup=e=>{if(!startPoint)return;const chosen=ghost?plan:null;end();if(grip.hasPointerCapture(e.pointerId))grip.releasePointerCapture(e.pointerId);if(chosen)move(p.id,chosen.parentId,chosen.order).catch(fail)};
       grip.onpointercancel=end;grip.onlostpointercapture=()=>{if(startPoint)end()};
     }
     container.append(row);
     if(!folded.has(p.id)||term)for(const c of children)add(c,depth+1);
   }
   const home=pages.find(p=>p.path==='/');if(home)add(home,0);
   for(const p of sorted(pages.filter(p=>p.path!=='/'&&(!pages.some(q=>q.path===parentPath(p.path))||parentPath(p.path)==='/'&&!home))))add(p,0);
   if(!container.querySelector('.page-tree-row'))container.append(el('div',{class:'pages-empty'},'검색 결과가 없습니다.'));
 }
 async function move(id,parentId,order){await commit({kind:'move',id,parentId,order})}
 function confirmRemove(page){
   const modal=formModal('정말 삭제하시겠습니까?',{saveLabel:'삭제'});modal.body.append(el('p',{},page.name));
   modal.save.onclick=async()=>{modal.save.disabled=true;try{await commit({kind:'delete',id:page.id},modal)}catch(e){fail(e,modal)}finally{modal.save.disabled=false}};
 }
 function settings(page,inline=false,newParent=null){
   const p=page||{name:'',path:(newParent?.path||'/')+'new-page/',type:'planned',published:false,seo:{},order:0,pcMenu:true,mobileMenu:true};
   const modal=inline?inlineSettings(page):formModal(page?'페이지 설정':'페이지 추가',{wide:true,saveLabel:'저장'});modal.dialog.classList.add('page-settings-panel');
   if(tabPageId!==p.id){settingsTab='basic';tabPageId=p.id}
   const paneId='page-pane-'+crypto.randomUUID();const panes={},tabs={};
   const tabNav=el('nav',{class:'page-setting-tabs',role:'tablist','aria-label':'선택 페이지 설정 항목'});
   const form=el('form',{});for(const [key,text]of [['basic','페이지 설정'],['redirect','리디렉션'],['seo','SEO']]){panes[key]=el('section',{role:'tabpanel',id:paneId+'-'+key});tabs[key]=button(text,()=>showTab(key),'');tabs[key].setAttribute('role','tab');tabs[key].id=paneId+'-tab-'+key;tabs[key].setAttribute('aria-controls',panes[key].id);panes[key].setAttribute('aria-labelledby',tabs[key].id);tabNav.append(tabs[key])}
   function showTab(key){settingsTab=key;for(const id of Object.keys(panes)){panes[id].hidden=id!==key;tabs[id].setAttribute('aria-selected',String(id===key));tabs[id].tabIndex=id===key?0:-1}}
   tabNav.onkeydown=e=>{const keys=Object.keys(panes);if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const index=keys.indexOf(settingsTab);showTab(keys[(index+(e.key==='ArrowRight'?1:2))%3]);tabs[settingsTab].focus()};
   form.append(tabNav,...Object.values(panes));showTab(settingsTab);
   form.onsubmit=e=>e.preventDefault();modal.body.append(form);
   const name=input(p.name);name.required=true;name.setAttribute('aria-label','관리자용 페이지명');const title=input(p.seo?.title||p.defaults?.title||'');title.setAttribute('aria-label','페이지 제목 (Title)');const menuName=input(p.menuName||'');menuName.setAttribute('aria-label','메뉴 표시 이름');
   const parents=active().filter(q=>q.id!==p.id&&q.path!=='/'&&q.path.endsWith('/')&&!q.path.startsWith(p.path)&&(!['dynamic','external','system'].includes(q.type)||q.path==='/forms/'));
   const currentParent=active().find(q=>q.path===parentPath(p.path)&&q.path!=='/');
   const parent=parentPicker([{id:'',name:'최상위',path:'/'},...parents.map(q=>({id:q.id,name:q.name,path:q.path}))],currentParent?.id||'');
   const slug=input(p.path==='/'?'':p.path.replace(/\/$/,'').split('/').pop());
   slug.pattern='[^/]*';slug.title='상위 경로는 위 항목에서 선택해 주세요.';
   const kind=select(page?Object.entries(types).filter(([k])=>!['system','dynamic'].includes(k)||k===p.type):[['planned','페이지'],['group','폴더']],p.type);
   const source=select([['','소스 연결 안 함'],...new Set(state.pages.map(q=>q.source).filter(Boolean))].map(x=>Array.isArray(x)?x:[x,x]),p.source||'');
   const external=input(p.externalUrl||'','url');external.placeholder='https://';
   const full=el('small',{}),urlValue=()=>p.path==='/'?'/':(active().find(q=>q.id===parent.value)?.path||'/').replace(/\/$/,'')+'/'+slug.value.replace(/^\/+|\/+$/g,'')+(slug.value.includes('.')?'':'/');
   let updatePreview=()=>{};const showUrl=()=>{full.textContent=publicUrl(urlValue());updatePreview()};slug.oninput=parent.onchange=showUrl;showUrl();
   if(p.protected){parent.disabled=slug.disabled=kind.disabled=source.disabled=true}
   const parentPrefix=el('small',{class:'page-parent-path'});const browserPreview=el('div',{class:'page-browser-preview','aria-label':'브라우저 제목 및 URL 미리보기'});updatePreview=()=>{parentPrefix.textContent=(active().find(q=>q.id===parent.value)?.path||'/');browserPreview.replaceChildren(el('div',{class:'page-browser-tab'},title.value||'페이지 제목'),el('div',{class:'page-browser-address'},publicUrl(urlValue())))};title.oninput=updatePreview;showUrl();
   const grid=el('div',{class:'page-settings-grid'},label('관리자용 페이지명',name),label('페이지 제목 (Title)',title),label('메뉴 표시 이름',menuName),label('상위 페이지',parent),el('label',{},'URL Slug',el('div',{class:'page-slug-field'},parentPrefix,slug)),el('label',{},'전체 URL',full));grid.append(el('div',{class:'full'},browserPreview));
   if(!page)grid.append(label('추가할 항목',kind));
   if(p.type==='external')grid.append(el('label',{class:'full'},'외부 링크 URL',external));
   const basic=el('fieldset',{class:'page-settings-section'},el('legend',{},'페이지 설정'),grid);panes.basic.append(basic);
   const published=el('input',{type:'checkbox',checked:!!p.published});if(p.type!=='group')basic.append(el('div',{class:'page-settings-checks'},label('공개',published)));if(p.protected)basic.append(el('small',{},'이 페이지의 주소는 변경할 수 없습니다.'));
   if(page)panes.redirect.append(pageRedirects(page));else panes.redirect.append(el('p',{class:'help'},'페이지를 저장한 후 이전 URL을 등록할 수 있습니다.'));
   if(!page)panes.basic.append(el('details',{class:'page-optional-settings'},el('summary',{},'기존 페이지 연결 (선택)'),label('연결된 소스',source)));
   const seo=seoFields(p.seo||{},()=>urlValue(),()=>title.value);title.addEventListener('input',()=>seo.update());
   if(p.type!=='group')panes.seo.append(seo.section);else panes.seo.append(el('p',{class:'help'},'콘텐츠가 없는 그룹에는 SEO 설정이 적용되지 않습니다.'));
   if(!p.source||p.bundleVersion){
     const file=el('input',{type:'file',accept:'.zip,application/zip',hidden:true,'aria-label':'페이지 디자인 ZIP'}),status=el('p',{class:'help',role:'status'},p.bundleVersion?(p.published&&p.publishedBundleVersion&&p.bundleVersion!==p.publishedBundleVersion?'새 디자인은 미리보기에만 반영됩니다. 확인 후 저장하면 공개 페이지에 반영됩니다.':'HTML·CSS·JS와 이미지가 포함된 디자인이 연결되어 있습니다.'):'최상위에 index.html을 포함한 HTML·CSS·JS·이미지 ZIP을 업로드하세요.');
     const upload=button(p.bundleVersion?'ZIP 교체':'ZIP 업로드',()=>file.click(),'button');upload.disabled=!page||!connected();
     file.onchange=async()=>{const zip=file.files[0];if(!zip)return;file.value='';upload.disabled=true;try{if(zip.size>50*1024*1024)throw Error('ZIP은 50MB 이하로 업로드해 주세요.');if(name.value.trim()!==p.name||urlValue()!==p.path||title.value.trim()!==(p.seo?.title||p.defaults?.title||''))throw Error('변경한 기본정보를 먼저 저장한 후 ZIP을 업로드해 주세요.');status.textContent='업로드 중…';await uploadPageBundle(p.id,zip);await refresh();toast('디자인을 적용했습니다. 미리보기에서 확인한 후 공개해 주세요.')}catch(e){status.textContent=e.message;toast(e.message,true)}finally{upload.disabled=!page||!connected()}};
     const actions=el('div',{class:'actions'},upload,file);if(p.bundleVersion)actions.append(el('a',{class:'button',href:pageBundleDownload(p.id),download:'page-design.zip'},'ZIP 다운로드'));
     panes.basic.append(el('fieldset',{class:'page-settings-section page-bundle-settings'},el('legend',{},'페이지 디자인'),status,actions));
     if(!page)status.textContent='기본정보를 저장하면 ZIP을 업로드할 수 있습니다.';
   }
   const footerActions=el('div',{class:'actions'});
   if(page?.source&&!page.path.includes(':'))footerActions.append(el('a',{class:'button',href:publicUrl('/dev'+page.path),target:'_blank',rel:'noopener'},'미리보기'));
   if(page&&!page.protected)footerActions.append(button('관리 항목 삭제',()=>{
     const confirm=formModal('페이지 관리 항목을 삭제할까요?',{saveLabel:'삭제'});confirm.body.append(el('p',{},'실제 소스 파일은 삭제하지 않습니다. '+page.name));confirm.save.onclick=async()=>{try{await commit({kind:'delete',id:page.id},modal);confirm.dialog.close()}catch(e){fail(e,confirm)}}
   },'button danger'));
   if(inline){const open=el('a',{class:'button small',href:p.type==='external'?p.externalUrl:publicUrl(p.path),target:'_blank',rel:'noopener'},'페이지 열기');if(p.published&&!p.path.includes(':')&&!['group','planned'].includes(p.type))footerActions.prepend(open);footerActions.prepend(button('URL 복사',safe(async()=>{await navigator.clipboard.writeText(p.type==='external'?p.externalUrl:publicUrl(p.path));toast('URL을 복사했습니다.')}),'button small'))}
   modal.footer.prepend(footerActions);
   modal.save.disabled=!connected();
   modal.save.onclick=async()=>{if(!form.reportValidity())return;modal.save.disabled=true;try{await commit({kind:'save',id:page?.id,values:{name:name.value.trim(),menuName:menuName.value.trim(),hoverName:p.hoverName||'',path:urlValue(),type:kind.value,source:source.value,externalUrl:external.value,published:published.checked,...(!page?{useSharedFooter:kind.value!=='group'}:{}),order:Number(p.order||0),seo:{...seo.read(),title:title.value.trim()},pcMenu:p.pcMenu!==false,mobileMenu:p.mobileMenu!==false}},modal)}catch(e){fail(e,modal)}finally{modal.save.disabled=false}};
 }
 function inlineSettings(page){
   const body=el('div',{class:'page-detail-body'}),save=button('저장',()=>{},'button primary');
   const footer=el('footer',{class:'page-detail-actions'},el('div',{class:'actions'},button('변경 취소',()=>settings(active().find(p=>p.id===page.id)||page,true)),save));
   const panel=el('div',{class:'panel page-detail-panel'},el('header',{class:'page-detail-head'},el('div',{},el('small',{},types[page.type]),el('h2',{},page.name),el('p',{},page.path))),body,footer);
   panel.close=()=>{};settingsHost.replaceChildren(panel);return {dialog:panel,body,footer,save};
 }
 function pageRedirects(page){
   const section=el('fieldset',{class:'page-settings-section page-redirect-section'},el('legend',{},'리디렉션'));
   const list=el('div',{class:'page-redirect-list'}),editor=el('div',{});
   const redraw=()=>section.replaceWith(pageRedirects(active().find(p=>p.id===page.id)||page));
   const entries=state.redirects.filter(r=>r.pageId===page.id);
   for(const rule of entries)list.append(el('article',{class:'page-redirect-row'},el('div',{},el('small',{},rule.sourceUrl||rule.from)),button('수정',()=>redirectSettings(rule,page,editor,redraw),'button small')));
   if(!entries.length)list.append(el('p',{class:'help'},'등록된 리디렉션이 없습니다.'));
   section.append(list,button('+ 리디렉션 추가',()=>redirectSettings(null,page,editor,redraw),'button small'),editor);return section;
 }
 function seoFields(values,path=()=>'/',pageTitle=()=>values.title||''){
   const controls={},grid=el('div',{class:'page-settings-grid'});
   for(const [key,title]of [['description','설명 (Meta Description)'],['canonical','Canonical URL'],['ogTitle','OG 제목'],['ogDescription','OG 설명'],['ogImage','OG 대표 이미지 URL'],['ogUrl','OG URL']]){const control=input(values[key]||'', ['canonical','ogImage','ogUrl'].includes(key)?'url':'text');control.placeholder=state.defaults?.[key]||'공통 설정 상속';controls[key]=control;grid.append(label(title,control))}
   for(const [key,title]of [['indexable','검색엔진 색인'],['sitemap','사이트맵 포함']]){controls[key]=select([['','공통 설정 상속'],['true','허용'],['false','제외']],values[key]==null?'':String(values[key]));grid.append(label(title,controls[key]))}
   const preview=el('div',{class:'page-search-preview'}),update=()=>preview.replaceChildren(el('small',{},publicUrl(path())),el('h3',{},pageTitle()||state.defaults?.title||'페이지 제목'),el('p',{},controls.description.value||state.defaults?.description||'페이지 설명'),el('hr',{}),el('strong',{},controls.ogTitle.value||pageTitle()||state.defaults?.ogTitle||'공유 제목'),el('p',{},controls.ogDescription.value||controls.description.value||state.defaults?.ogDescription||''));
   const originalUpdate=update;
   const refreshPreview=()=>{originalUpdate();const url=controls.ogImage.value||state.defaults?.ogImage;if(/^https?:\/\//.test(url||'')){const image=el('img',{src:url,alt:'OG 대표 이미지 미리보기'});image.style.cssText='width:160px;max-width:100%;height:auto;margin-top:12px;border-radius:8px';preview.append(image)}};
   for(const c of Object.values(controls))c.addEventListener('input',refreshPreview);refreshPreview();
   return {update:refreshPreview,section:el('fieldset',{class:'page-settings-section'},el('legend',{},'SEO · Open Graph'),grid,preview),read:()=>Object.fromEntries(Object.entries(controls).map(([k,c])=>[k,['indexable','sitemap'].includes(k)?(c.value===''?null:c.value==='true'):c.value]))};
 }
 function redirectSettings(rule,boundPage,host,onSaved){
   const from=input(rule?.sourceUrl||rule?.from||'','text',{placeholder:'https://이전주소.com/페이지','aria-label':'이전 링크'});
   const save=button('저장',async()=>{
     save.disabled=true;
     try{
       if(!from.value.trim())throw Error('이전 링크를 붙여넣어 주세요.');
       await pageOperation({kind:'redirect',redirectId:rule?.id,values:{from:from.value.trim(),to:boundPage.path,status:301,active:true,keepQuery:true,pageId:boundPage.id}});
       state=pageState();host.replaceChildren();onSaved?.();toast('301 리디렉션을 저장했습니다.');
     }catch(e){fail(e,{body:panel})}finally{save.disabled=!connected()}
   },'button primary');
   const panel=el('div',{class:'page-redirect-editor page-redirect-simple'},label('이 페이지로 연결할 이전 링크',from),el('div',{class:'actions'},button('취소',()=>host.replaceChildren()),save));
   from.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(!save.disabled)save.click()}};
   save.disabled=!connected();host.replaceChildren(panel);from.focus();
 }
 render();
}
