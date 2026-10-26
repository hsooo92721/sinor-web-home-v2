// Resolve the current release even when an HTML page or navigation entry is cached.
const fallback='17';let version=fallback;
try{const url=new URL('release.json',import.meta.url);url.searchParams.set('_',Date.now());const response=await fetch(url,{cache:'no-store'});if(response.ok){const release=await response.json();if(typeof release.version==='string'&&/^[a-zA-Z0-9_-]{1,40}$/.test(release.version))version=release.version}}catch{}
window.SINOR_ADMIN_BUILD=version;
const css=new URL('admin.css',import.meta.url);css.searchParams.set('v',version);let link=[...document.querySelectorAll('link[rel=stylesheet]')].find(el=>new URL(el.href).pathname.endsWith('/admin/admin.css'));if(!link){link=document.createElement('link');link.rel='stylesheet';document.head.append(link)}link.href=css.href;
await import(new URL('admin.js?v='+encodeURIComponent(version),import.meta.url).href);
