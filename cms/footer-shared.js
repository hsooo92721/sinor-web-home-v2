const root=new URL('../',import.meta.url);
export const footerDesignDefaults={background:'#fafafa',primaryColor:'#606060',textColor:'#7d7d7d',logoColor:'#bcbcbc',primarySize:16,mobilePrimarySize:14,secondarySize:14,paddingY:44,paddingX:28,mobilePaddingY:26,mobilePaddingX:16,gap:13};
export function footerHref(value){const url=new URL(String(value),root);if(!['http:','https:','mailto:','tel:'].includes(url.protocol)||url.username||url.password)throw Error('올바른 링크 주소를 입력해 주세요.');return url.href}
export async function footerTemplate(){
 const response=await fetch(new URL('components/footer.html',root),{cache:'no-cache'});if(!response.ok)throw Error('공통 푸터를 불러오지 못했습니다.');
 const doc=new DOMParser().parseFromString(await response.text(),'text/html'),footer=doc.querySelector('.app-footer');
 for(const node of footer.querySelectorAll('[href],[src]'))for(const attr of ['href','src'])if(node.hasAttribute(attr))node.setAttribute(attr,new URL(node.getAttribute(attr),new URL('components/footer.html',root)).href);
 return footer;
}
export function footerLinkValues(footer){return [...footer.querySelectorAll('a[data-footer-link]')].map(a=>({id:a.dataset.footerLink,label:a.getAttribute('aria-label')||a.textContent.trim()||a.querySelector('img')?.alt||'링크',url:a.href}));}
export function normalizeFooterDesign(value={}){
 const design={...footerDesignDefaults,...value};
 for(const key of ['background','primaryColor','textColor','logoColor'])if(!/^#[0-9a-f]{6}$/i.test(design[key]))throw Error('색상 값을 확인해 주세요.');
 for(const key of ['primarySize','mobilePrimarySize','secondarySize']){design[key]=Number(design[key]);if(!Number.isFinite(design[key])||design[key]<8||design[key]>30)throw Error('글자 크기는 8~30px로 입력해 주세요.');}
 for(const key of ['paddingY','paddingX','mobilePaddingY','mobilePaddingX','gap']){design[key]=Number(design[key]);if(!Number.isFinite(design[key])||design[key]<0||design[key]>120)throw Error('여백은 0~120px로 입력해 주세요.');}
 return design;
}
const svgCache=new Map();
async function tintLogo(img,color){
 const src=img.dataset.footerOriginalSrc||img.src;img.dataset.footerOriginalSrc=src;
 if(color.toLowerCase()===footerDesignDefaults.logoColor){img.src=src;return}
 if(!svgCache.has(src))svgCache.set(src,fetch(src).then(r=>{if(!r.ok)throw Error('logo');return r.text()}));
 try{const doc=new DOMParser().parseFromString(await svgCache.get(src),'image/svg+xml');for(const node of doc.querySelectorAll('[fill],[stroke]'))for(const key of ['fill','stroke']){const value=node.getAttribute(key);if(value&&value!=='none'&&!value.startsWith('url('))node.setAttribute(key,color)}img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(doc))}catch{}
}
export async function applyFooterSettings(footer,settings){
 const doc=footer.ownerDocument,data=settings.footer||{},names={상호명:'company',대표자:'representative',주소:'address',사업자등록번호:'businessNumber',통신판매업신고:'commerce',관광사업자등록:'tourism',국내결혼중개업:'marriage',이메일:'email',문의:'phone'};
 for(const row of footer.querySelectorAll('dl>div')){const key=names[row.querySelector('dt')?.textContent.trim()];if(key&&data[key]!=null){const dd=row.querySelector('dd');dd.textContent=key==='phone'&&String(data[key]).includes('02-506-5670')?'02-508-5670':data[key];dd.style.whiteSpace='pre-line'}}
 if(data.company)for(const el of footer.querySelectorAll('.footer-business-toggle'))el.textContent=data.company+' 사업자정보';
 if(data.copyright)for(const el of footer.querySelectorAll('.copyright'))el.textContent=data.copyright;
 for(const link of settings.footerLinks||[]){const a=[...footer.querySelectorAll('a[data-footer-link]')].find(a=>a.dataset.footerLink===link.id);if(!a)continue;try{a.href=footerHref(link.url)}catch{continue}if(a.querySelector('img,svg,.footer-app-store-art'))a.setAttribute('aria-label',link.label);else a.textContent=link.label}
 let style=doc.querySelector('#shared-footer-custom-design');if(!settings.footerDesign||!Object.keys(settings.footerDesign).length){style?.remove();return}
 const d=normalizeFooterDesign(settings.footerDesign);if(!style){style=doc.createElement('style');style.id='shared-footer-custom-design';doc.head.append(style)}
 style.textContent=`body .app-footer{background:${d.background}!important;color:${d.textColor}!important;padding:${d.paddingY}px ${d.paddingX}px!important;gap:${d.gap}px!important}body .app-footer .footer-primary a{color:${d.primaryColor}!important;font-size:${d.primarySize}px!important}body .app-footer .footer-secondary a,body .app-footer .company-info summary,body .app-footer .footer-business-content{color:${d.textColor}!important;font-size:${d.secondarySize}px!important}@media(max-width:767px){body .app-footer,body.company-page .company-common-footer .app-footer{padding:${d.mobilePaddingY}px ${d.mobilePaddingX}px!important}body .app-footer .footer-primary a{font-size:${d.mobilePrimarySize}px!important}}@media(max-width:367px){body .app-footer .footer-primary a{font-size:clamp(10px,calc((100vw - ${d.mobilePaddingX*2+2}px)*.042),${d.mobilePrimarySize}px)!important}}`;
 await Promise.all([...footer.querySelectorAll('.footer-brand-art img')].map(img=>tintLogo(img,d.logoColor)));
}
