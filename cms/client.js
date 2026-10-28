import {normalizeLegacyUrls} from './legacy-urls.js?v=1';
import {numberedPosts as assignNumbers} from './column-listing.js?v=1';
import {normalizeKeywords} from './keywords.js';
const config=window.SINOR_CMS_CONFIG||{mode:'demo',apiBase:'/api'};
export const mode=config.mode;
export const siteRoot=new URL('../',import.meta.url);
export const siteUrl=path=>{const url=new URL(path,siteRoot);if(window.SINOR_ADMIN_BUILD&&url.pathname.startsWith(new URL('admin/',siteRoot).pathname))url.searchParams.set('v',window.SINOR_ADMIN_BUILD);return url.href};
const columnNumbers=new Map();
function numberedPosts(items){const posts=assignNumbers(items);posts.forEach(p=>{if(p.columnNumber)columnNumbers.set(p.id,p.columnNumber)});return posts}
export const articleUrl=(id,preview=false)=>!preview&&columnNumbers.has(id)?siteUrl(`columns/${columnNumbers.get(id)}`):siteUrl(`columns/view/?id=${encodeURIComponent(id)}${preview?'&preview=1':''}`);
export const defaults=[{id:'travel',name:'여행',order:0},{id:'life',name:'생활·문화',order:1},{id:'health',name:'건강',order:2}];
const now=()=>new Date().toISOString();
let database;
let channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('sinor-cms:'+siteRoot.pathname):null;
export function watch(callback){const handler=()=>callback();channel?.addEventListener('message',handler);window.addEventListener('sinor-cms-change',handler);return()=>{channel?.removeEventListener('message',handler);window.removeEventListener('sinor-cms-change',handler)}}
function changed(){channel?.postMessage('changed');window.dispatchEvent(new Event('sinor-cms-change'))}
async function db(){
 if(database)return database;
 database=new Promise((resolve,reject)=>{
  const request=indexedDB.open('sinor-columns-cms:'+siteRoot.pathname,1);
  request.onupgradeneeded=()=>{const d=request.result;d.createObjectStore('posts',{keyPath:'id'});const categories=d.createObjectStore('categories',{keyPath:'id'});defaults.forEach(item=>categories.add(item));};
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('브라우저 저장소를 열 수 없습니다. 저장소 사용 설정을 확인해 주세요.'));
 });
 return database;
}
async function store(name,method,value){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(name,method==='getAll'||method==='get'?'readonly':'readwrite');let result;const req=tx.objectStore(name)[method](value);req.onsuccess=()=>result=req.result;tx.oncomplete=()=>resolve(result);tx.onabort=tx.onerror=()=>reject(new Error('저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.'));})}
async function request(path,options={}){
 const headers={...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...options.headers};
 const response=await fetch(config.apiBase.replace(/\/$/,'')+path,{credentials:config.credentials||'same-origin',...options,headers});
 if(!response.ok){let message='요청을 처리하지 못했습니다.';try{message=(await response.json()).message||message}catch{}throw new Error(message)}
 return response.status===204?null:response.json();
}
export function safeUrl(value,image=false){
 if(typeof value!=='string'||!value.trim())return '';
 if(image&&/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value))return value;
 try{const u=new URL(value,siteRoot);if(['http:','https:'].includes(u.protocol)||(!image&&['mailto:','tel:'].includes(u.protocol)))return u.href}catch{}return '';
}
export function sanitizeHtml(html){
 const doc=new DOMParser().parseFromString(String(html||''),'text/html');
 const allowed=new Set('p br strong b em i u s strike small mark section article header h1 h2 h3 h4 ul ol li a img blockquote hr div span table thead tbody tfoot tr th td figure figcaption pre code'.split(' '));
 const styles=new Set('color background background-color font-size font-family font-weight font-style line-height text-decoration text-decoration-line text-decoration-color text-decoration-style text-decoration-thickness text-align border border-color border-width border-style border-radius padding margin width max-width height max-height vertical-align list-style-type'.split(' '));
 function clean(parent){for(const node of [...parent.childNodes]){if(node.nodeType===Node.COMMENT_NODE){node.remove();continue}if(node.nodeType!==Node.ELEMENT_NODE)continue;const tag=node.tagName.toLowerCase();if(['script','style','iframe','object','embed','form','input','button','link','meta','svg','math'].includes(tag)){node.remove();continue}clean(node);if(!allowed.has(tag)){node.replaceWith(...node.childNodes);continue}const attrs=[...node.attributes];for(const a of attrs){const key=a.name,value=a.value;node.removeAttribute(key);if(key==='class'){const classes=value.split(/\s+/).filter(c=>/^[a-zA-Z_][a-zA-Z0-9_-]{0,79}$/.test(c));if(classes.length)node.className=classes.join(' ')}else if(tag==='a'&&key==='href'){const url=safeUrl(value);if(url)node.setAttribute('href',url)}else if(tag==='img'&&key==='src'){const url=safeUrl(value,true);if(url)node.setAttribute('src',url)}else if(tag==='img'&&key==='alt'){node.setAttribute(key,value)}else if(['td','th'].includes(tag)&&['colspan','rowspan'].includes(key)&&/^\d{1,2}$/.test(value)){node.setAttribute(key,value)}else if(key==='style'&&!/url\s*\(|expression|@import/i.test(value)){const scratch=document.createElement('span');scratch.style.cssText=value;for(const prop of [...scratch.style])if(styles.has(prop))node.style.setProperty(prop,scratch.style.getPropertyValue(prop));}}
 if(tag==='a'){node.target='_blank';node.rel='noopener noreferrer'}if(tag==='img'){if(!node.getAttribute('src'))node.remove();else node.loading='lazy';}}
 }
 clean(doc.body);return doc.body.innerHTML;
}
function validate(input){
 const title=String(input.title||'').trim();if(!title)throw new Error('제목을 입력해 주세요.');if(title.length>120)throw new Error('제목은 120자까지 입력할 수 있습니다.');
 if(!['draft','published','private','trash'].includes(input.status))throw new Error('올바른 공개 상태가 아닙니다.');
 const readMinutes=Number(input.readMinutes??6);if(!Number.isInteger(readMinutes)||readMinutes<1||readMinutes>120)throw new Error('읽는 시간은 1~120분으로 입력해 주세요.');
 const displayDate=String(input.displayDate||'');if(displayDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(displayDate)||Number.isNaN(Date.parse(displayDate))||new Date(displayDate).toISOString().slice(0,10)!==displayDate))throw new Error('날짜를 확인해 주세요.');
 const keywords=normalizeKeywords(input.keywords);if(keywords.length>30||keywords.some(k=>k.length>60))throw new Error('키워드는 최대 30개, 각 60자까지 입력할 수 있어요.');
 const customCss=String(input.customCss||'');if(customCss.length>200000)throw new Error('스타일 코드는 200,000자 이하로 입력해 주세요.');
 const bodyHtml=sanitizeHtml(input.bodyHtml);
 if(input.status==='published'&&!bodyHtml.replace(/<[^>]*>/g,'').trim()&&!/<img\b/.test(bodyHtml))throw new Error('공개할 칼럼의 본문을 입력해 주세요.');
 const authorId=String(input.authorId||'').slice(0,80),authorProfile=input.authorProfile?{id:authorId,name:String(input.authorProfile.name||'').trim().slice(0,60),affiliation:String(input.authorProfile.affiliation||'').trim().slice(0,100),position:String(input.authorProfile.position||'').trim().slice(0,100),bio:String(input.authorProfile.bio||'').trim().slice(0,3000),image:safeUrl(input.authorProfile.image||'',true)}:null;
 return {...input,legacyUrls:normalizeLegacyUrls(input.legacyUrls||input.sourceUrl||[]),authorId,authorProfile,title,bodyHtml,customCss,styleId:String(input.styleId||'common'),keywords,readMinutes,displayDate,subtitle:String(input.subtitle||'').trim().slice(0,300),expertName:String(input.expertName||'').trim().slice(0,100),excerpt:String(input.excerpt||'').trim().slice(0,240),author:String(input.author||'시놀').trim().slice(0,60),thumbnail:safeUrl(input.thumbnail||'',true),featured:!!input.featured};
}
export const cms={
 async categories(){return mode==='api'?request('/columns/categories'):(await store('categories','getAll')).sort((a,b)=>a.order-b.order)},
 async saveCategory(input){const name=String(input.name||'').trim();if(!name||name.length>30)throw new Error('카테고리 이름을 1~30자로 입력해 주세요.');const categories=await this.categories();if(categories.some(c=>c.id!==input.id&&c.name===name))throw new Error('같은 이름의 카테고리가 있습니다.');const color=String(input.color||categories.find(c=>c.id===input.id)?.color||'#2871e9').toLowerCase();if(!/^#[a-f\d]{6}$/i.test(color))throw new Error('카테고리 색상은 HEX 6자리로 입력해 주세요.');const item={id:input.id||crypto.randomUUID(),name,color,order:input.order??categories.length};if(mode==='api')await request('/admin/columns/categories'+(input.id?'/'+encodeURIComponent(input.id):''),{method:input.id?'PUT':'POST',body:JSON.stringify(item)});else await store('categories','put',item);changed();return item},
 async deleteCategory(id){if(mode==='api')await request('/admin/columns/categories/'+encodeURIComponent(id),{method:'DELETE'});else{if((await this.adminPosts()).some(p=>p.categoryId===id))throw new Error('사용 중인 카테고리는 삭제할 수 없습니다. 칼럼의 카테고리를 먼저 바꿔 주세요.');await store('categories','delete',id)}changed()},
 async adminPosts(){return mode==='api'?numberedPosts(await request('/admin/columns')):numberedPosts(await store('posts','getAll')).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))},
 async adminPost(id){const item=mode==='api'?await request('/admin/columns/'+encodeURIComponent(id)):await store('posts','get',id);if(!item)throw new Error('칼럼을 찾을 수 없습니다.');return item},
 async publicPosts(){const items=mode==='api'?await request('/columns'):await store('posts','getAll');return numberedPosts(items).filter(p=>p.status==='published').sort((a,b)=>(b.displayDate||b.publishedAt||'').localeCompare(a.displayDate||a.publishedAt||'')||(b.publishedAt||'').localeCompare(a.publishedAt||''))},
 async publicPost(id){if(mode==='api')return request('/columns/'+encodeURIComponent(id));const item=await this.adminPost(id);if(item.status!=='published')throw new Error('공개되지 않았거나 삭제된 칼럼입니다.');return item},
 async savePost(input){const data=validate(input);const old=input.id?await this.adminPost(input.id):null;if(old&&old.version!==input.version)throw new Error('다른 화면에서 이 글이 수정되었습니다. 새로고침 후 다시 저장해 주세요.');const categories=await this.categories();if(data.categoryId&&!categories.some(c=>c.id===data.categoryId))throw new Error('카테고리를 다시 선택해 주세요.');if(data.legacyUrls.length){const other=await this.adminPosts();if(other.some(p=>p.id!==input.id&&(p.legacyUrls||[]).some(url=>data.legacyUrls.includes(url))))throw new Error('이전 주소가 다른 칼럼에 이미 연결되어 있습니다.');}const post={...data,id:old?.id||crypto.randomUUID(),createdAt:old?.createdAt||now(),updatedAt:now(),version:(old?.version||0)+1,publishedAt:data.status==='published'?(old?.publishedAt||now()):old?.publishedAt||null};let saved;if(mode==='api')saved=await request('/admin/columns'+(old?'/'+encodeURIComponent(old.id):''),{method:old?'PUT':'POST',body:JSON.stringify(post)});else{const d=await db();await new Promise((resolve,reject)=>{const tx=d.transaction('posts','readwrite'),s=tx.objectStore('posts');const get=s.get(post.id);get.onsuccess=()=>{if(old&&get.result?.version!==old.version){tx.abort();return}s.put(post)};tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(new Error('저장 충돌 또는 저장 공간 부족으로 저장하지 못했습니다.'))});saved=post}changed();return saved},
 async setStatus(id,status){const p=await this.adminPost(id);return this.savePost({...p,status})},
 async upload(file){if(!file||!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))throw new Error('JPG, PNG, WebP, GIF 이미지만 업로드할 수 있습니다.');if(file.size>5*1024*1024)throw new Error('이미지는 5MB 이하로 올려 주세요.');if(mode==='api'){const data=new FormData();data.append('file',file);return request('/admin/media',{method:'POST',body:data})}return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({url:reader.result});reader.onerror=()=>reject(new Error('이미지를 읽지 못했습니다.'));reader.readAsDataURL(file)})},
};
export function formatDate(value){return value?new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)):'—'}
export function excerpt(html){return new DOMParser().parseFromString(html||'','text/html').body.textContent.trim().slice(0,160)}
