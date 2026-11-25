const base = window.SINOR_PAGE_MANAGEMENT_API || '/_page-management';
let state;
export async function loadPages() {
  try {
    const response=await fetch(base+'/state',{cache:'no-store',credentials:'same-origin'});
    if(!response.ok) throw Error();
    state=await response.json();
    if(!Array.isArray(state.pages)||!state.backend)throw Error();
  } catch {
    const manifest=await(await fetch(new URL('./page-registry.json',import.meta.url),{cache:'no-store'})).json();
    state={pages:manifest.pages,redirects:[],history:[],inventory:manifest,revision:0,backend:'static',defaults:{}};
  }
  return state;
}
export async function pageOperation(operation,preview=false) {
  if(state.backend==='static')throw Error('페이지 운영 서버 연결이 필요합니다. 로컬 페이지관리 서버에서 설정할 수 있습니다.');
  const response=await fetch(base+(preview?'/preview':'/change'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Page-Token':state.token},body:JSON.stringify({...operation,revision:state.revision})});
  const result=await response.json();
  if(!response.ok)throw Error(result.error||'저장하지 못했습니다.');
  if(!preview)state={...result,token:state.token,backend:state.backend};
  return result;
}
export const pageState=()=>state;
export const pageParent=path=>path==='/'?null:'/'+path.replace(/^\/+|\/+$/g,'').split('/').slice(0,-1).join('/')+'/';
export function parentPath(path){const p=pageParent(path);return p==='//'?'/':p}
export function publicUrl(path){const root=new URL('../',import.meta.url);return new URL(path.replace(/^\//,''),root).href}

export async function uploadPageBundle(pageId,file){
 if(state.backend==='static')throw Error('ZIP 업로드는 페이지 운영 서버 연결이 필요합니다.');
 const r=await fetch(base+'/page-bundle',{method:'POST',credentials:'same-origin',headers:{'X-Page-Token':state.token,'X-Page-Id':pageId,'X-Page-Revision':String(state.revision),'Content-Type':'application/zip'},body:file});const result=await r.json();if(!r.ok)throw Error(result.error||'ZIP을 업로드하지 못했습니다.');state={...result,token:state.token,backend:state.backend};return state;
}
export const pageBundleDownload=id=>base+'/page-bundle?id='+encodeURIComponent(id);
