// Client-rendered CMS pages must also retain an explicit administrator Title.
const managedTitle=window.SINOR_PAGE_ROUTE?.title;
if(managedTitle){const title=document.querySelector('title');if(title){const sync=()=>{if(document.title!==managedTitle)document.title=managedTitle};sync();new MutationObserver(sync).observe(title,{childList:true,subtree:true,characterData:true})}}
// Menu placement belongs to the existing shared header/footer, never this page registry.
