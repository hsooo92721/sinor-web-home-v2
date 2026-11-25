const footerScriptUrl=document.currentScript.src;
const root=new URL('.',footerScriptUrl);
(async()=>{
 if(![...document.querySelectorAll('link[rel=stylesheet]')].some(l=>new URL(l.href).pathname.endsWith('/footer.css'))){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('footer.css',root).href;document.head.append(css)}
 const {footerTemplate}=await import(new URL('cms/footer-shared.js?v=1',root));
 const targets=[...document.querySelectorAll('[data-shared-footer],footer.app-footer')];
 if(targets.length){const template=await footerTemplate();for(const footer of targets){
   const open=footer.querySelector('.company-info')?.open;
   footer.dataset.figmaNode=template.dataset.figmaNode;footer.dataset.sharedFooter='';
   footer.replaceChildren(...template.cloneNode(true).childNodes);
   if(!footer.hasAttribute('data-footer-new-tab'))for(const link of footer.querySelectorAll('a'))if(link.href.startsWith(root.href)){link.removeAttribute('target');link.removeAttribute('rel')}
   const details=footer.querySelector('.company-info');if(details){details.open=!!open;details.addEventListener('toggle',()=>{window.dispatchEvent(new Event('scroll'));if(details.open)requestAnimationFrame(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}))})}
 }}
 await import(new URL('cms/site-settings-public.js?v=5',root));
 window.dispatchEvent(new Event('scroll'));
})().catch(error=>console.warn('공통 푸터를 불러오지 못했습니다.',error));
