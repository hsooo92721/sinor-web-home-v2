// Resolve the current release even when an HTML page or navigation entry is cached.
const fallback='71';let version=fallback;
try{const url=new URL('release.json',import.meta.url);url.searchParams.set('_',Date.now());const response=await fetch(url,{cache:'no-store'});if(response.ok){const release=await response.json();if(typeof release.version==='string'&&/^[a-zA-Z0-9_-]{1,40}$/.test(release.version))version=release.version}}catch{}
window.SINOR_ADMIN_BUILD=version;
const css=new URL('admin.css',import.meta.url);css.searchParams.set('v',version);let link=[...document.querySelectorAll('link[rel=stylesheet]')].find(el=>new URL(el.href).pathname.endsWith('/admin/admin.css'));if(!link){link=document.createElement('link');link.rel='stylesheet';document.head.append(link)}link.href=css.href;
for(const link of document.querySelectorAll('link[rel=stylesheet]')){const url=new URL(link.href);if(url.pathname.endsWith('/columns/content.css')){url.searchParams.set('v',version);link.href=url.href}}
await import(new URL('admin.js?v='+encodeURIComponent(version),import.meta.url).href);

// Remove browser records belonging to the retired column traffic feature.
try{for(const key of Object.keys(localStorage))if(key.startsWith('sinor-column-analytics:'))localStorage.removeItem(key)}catch{}
