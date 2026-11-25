import {footerCodeEditor,formatFooterSource} from './footer-code-editor.js?v=1';
import {el,input,label,button} from './forms-ui.js?v=1';
import {getSettings,saveFooterSettings,settingsStorage} from '../cms/site-settings.js?v=5';
import {footerTemplate,applyFooterSettings} from '../cms/footer-shared.js?v=1';
import {siteUrl} from '../cms/client.js?v=26';
export async function footerAdmin(root,toast){
 const settings=await getSettings();let template=await footerTemplate();
 let source=null,sourceToken='',sourceDirty=false;try{const r=await fetch('/_page-management/footer-source',{cache:'no-store'});if(r.ok){source=await r.json();sourceToken=source.token}}catch{}
 if(!source){const r=await fetch(siteUrl('footer.css'));source={html:template.outerHTML,css:await r.text(),version:''}}
 const banner=document.querySelector('.mode-banner span');if(banner)banner.textContent=settingsStorage()==='browser'?'작업용 미리보기 · 전체 적용은 운영 서버 연결 후 가능합니다.':'공통 푸터 연결됨 · 저장하면 모든 페이지에 반영됩니다.';
 let draft=structuredClone(settings),section='html',previewFrame,drawVersion=0,codeMode=false,codeEditors=[];
 const page=el('div',{class:'footer-admin'}),editor=el('section',{class:'panel footer-edit-panel'}),body=el('div',{class:'footer-edit-body'});
 const save=button('저장',async()=>{save.disabled=true;try{
   const savingCode=sourceDirty;
   if(sourceDirty){source=await formatFooterSource(source);if(!sourceToken)throw Error('코드 저장은 페이지 운영 서버 연결이 필요합니다.');const r=await fetch('/_page-management/footer-source',{method:'POST',headers:{'Content-Type':'application/json','X-Page-Token':sourceToken},body:JSON.stringify(source)});const result=await r.json();if(!r.ok)throw Error(result.error||'푸터 코드를 저장하지 못했습니다.');source=result;sourceDirty=false;template=await footerTemplate();previewFrame=null;}
   if(savingCode){draft.footerDesign={};draft.footerLinks=[];codeMode=true}
   const saved=await saveFooterSettings(structuredClone(draft));draft=structuredClone(saved);
   status.textContent='저장했습니다.';toast('모든 페이지의 공통 푸터에 적용했습니다.');await preview();
 }catch(e){toast(e.message,true)}finally{save.disabled=false}},'button primary');
 const status=el('span',{class:'help',role:'status'});
 page.append(el('div',{class:'page-head'},el('div',{},el('h1',{},'푸터관리'),el('p',{},'한 번 저장하면 모든 페이지의 공통 푸터에 적용됩니다.')),save));
 const previewWrap=el('section',{class:'panel footer-live-preview'}),previewHost=el('div',{class:'footer-preview-host'});
 const mobile=button('모바일',()=>{previewHost.classList.add('is-mobile');fitPreview()},'button small'),desktop=button('PC',()=>{previewHost.classList.remove('is-mobile');fitPreview()},'button small');
 previewWrap.append(el('header',{},el('strong',{},'미리보기'),el('div',{class:'actions'},desktop,mobile)),previewHost);page.append(previewWrap);
 const tabs=el('nav',{class:'settings-tabs','aria-label':'푸터 편집'});
 for(const [key,title]of [['html','HTML'],['css','CSS'],['business','사업자 정보']]){const b=button(title,()=>{section=key;render()},'');b.dataset.section=key;tabs.append(b)}
 editor.append(tabs,body,el('footer',{class:'footer-edit-save'},status,button('저장',()=>save.click(),'button primary')));page.append(editor);root.replaceChildren(page);
 function field(title,control){return label(title,control)}
 function changed(){codeMode=false;status.textContent='저장하지 않은 변경사항';preview()}
 function render(){
  for(const b of tabs.querySelectorAll('button'))b.classList.toggle('active',b.dataset.section===section);
  for(const editor of codeEditors)editor.destroy();codeEditors=[];body.replaceChildren();
  if(section==='html'||section==='css'){
   const host=el('div',{class:'footer-code-shell'});body.append(host);
   const language=section;
   footerCodeEditor(host,source[language],language,value=>{source[language]=value;sourceDirty=true;codeMode=true;status.textContent='저장하지 않은 변경사항';previewFrame=null;preview()}).then(editor=>{if(editor)codeEditors.push(editor)});
  }else{
   const grid=el('div',{class:'footer-business-grid'});
   for(const [key,title]of [['company','상호명'],['representative','대표자'],['address','주소'],['businessNumber','사업자등록번호'],['commerce','통신판매업신고'],['tourism','관광사업자등록'],['marriage','국내결혼중개업'],['email','이메일'],['phone','문의 전화'],['copyright','저작권 표시']]){const control=key==='address'?el('textarea',{class:'input',rows:3,value:draft.footer[key]}):input(draft.footer[key]);control.oninput=()=>{draft.footer[key]=control.value;changed()};const f=field(title,control);if(key==='address')f.classList.add('full');grid.append(f)}body.append(grid);
  }
 }
 function fitPreview(){if(!previewFrame?.contentDocument?.body)return;const width=previewHost.classList.contains('is-mobile')?393:1120,available=Math.max(1,previewHost.clientWidth-28),scale=Math.min(1,available/width);previewFrame.style.width=width+'px';previewFrame.style.transform='scale('+scale+')';previewFrame.style.left=Math.max(14,(previewHost.clientWidth-width*scale)/2)+'px';const height=Math.ceil(previewFrame.contentDocument.body.getBoundingClientRect().height);previewFrame.style.height=height+'px';previewHost.style.height=Math.ceil(height*scale+28)+'px'}
 async function preview(){
  const version=++drawVersion;
  if(previewFrame?.contentDocument?.querySelector('.app-footer')){
    try{await applyFooterSettings(previewFrame.contentDocument.querySelector('.app-footer'),codeMode?{...draft,footerDesign:{},footerLinks:[]}:draft);fitPreview()}catch{}return;
  }
  const iframe=el('iframe',{title:'공통 푸터 미리보기'});previewFrame=iframe;previewHost.replaceChildren(iframe);
  const base=new URL('../',import.meta.url).href;
  const parsed=new DOMParser().parseFromString(sourceDirty?source.html:template.outerHTML,'text/html'),previewFooter=parsed.querySelector('.app-footer');if(!previewFooter){previewHost.replaceChildren(el('p',{},'app-footer 클래스를 가진 footer가 필요합니다.'));return}for(const node of previewFooter.querySelectorAll('[src],[href]'))for(const attr of ['src','href'])if(node.hasAttribute(attr)){try{const url=new URL(node.getAttribute(attr),new URL('components/footer.html',base));if(['http:','https:','mailto:','tel:'].includes(url.protocol))node.setAttribute(attr,url.href);else node.removeAttribute(attr)}catch{node.removeAttribute(attr)}}for(const node of previewFooter.querySelectorAll('script,iframe,object,embed,link,meta,style'))node.remove();for(const node of [previewFooter,...previewFooter.querySelectorAll('*')])for(const attr of [...node.attributes])if(/^on/i.test(attr.name))node.removeAttribute(attr.name);
  iframe.setAttribute('sandbox','allow-same-origin');
  iframe.srcdoc='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="'+siteUrl('footer.css')+'"><style>@font-face{font-family:Pretendard;font-weight:100 900;src:url("'+siteUrl('assets/vendor/pretendard/PretendardVariable.woff2')+'")}body{margin:0}.app-footer{margin-top:0!important}a{cursor:default}</style></head><body>'+previewFooter.outerHTML+'<style>'+source.css.replace(/<\/style/gi,'')+'</style></body></html>';
  iframe.onload=async()=>{if(iframe!==previewFrame)return;const doc=iframe.contentDocument;doc.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault()});await applyFooterSettings(doc.querySelector('.app-footer'),codeMode?{...draft,footerDesign:{},footerLinks:[]}:draft);new ResizeObserver(fitPreview).observe(doc.body);fitPreview()};
 }
 new ResizeObserver(fitPreview).observe(previewHost);previewHost.classList.remove('is-mobile');render();await preview();
}
