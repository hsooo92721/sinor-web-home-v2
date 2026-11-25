// Shared by pointer feedback and the committed move, so the preview is exact.
export function pageDropPlan(pages,sourceId,targetId,ratio){
 const source=pages.find(p=>p.id===sourceId),target=pages.find(p=>p.id===targetId);
 if(!source||!target||source.protected||sourceId===targetId||source.path!=='/'&&target.path.startsWith(source.path))return null;
 const parentPath=path=>'/'+path.replace(/^\/+|\/+$/g,'').split('/').slice(0,-1).join('/')+'/';
 const parent=path=>parentPath(path).replace(/^\/\/$/,'/');
 const canContain=target.path.endsWith('/')&&!['dynamic','external','system'].includes(target.type)&&!target.path.includes(':');
 let zone=ratio<.25?'before':ratio>.75?'after':'inside';
 if(zone==='inside'&&!canContain)zone=ratio<.5?'before':'after';
 if(zone==='inside'){
  const children=pages.filter(p=>p.id!==sourceId&&parent(p.path)===target.path);
  return {zone,parentId:target.path==='/'?null:target.id,order:Math.max(-10,...children.map(p=>Number(p.order||0)))+10,label:`${target.name} 하위로 이동`};
 }
 if(target.path==='/')return null;
 const siblings=pages.filter(p=>p.id!==sourceId&&parent(p.path)===parent(target.path)).sort((a,b)=>Number(a.order||0)-Number(b.order||0)||a.path.localeCompare(b.path));
 const i=siblings.findIndex(p=>p.id===targetId),order=Number(target.order||0);
 const neighbor=zone==='before'?Number(siblings[i-1]?.order??order-20):Number(siblings[i+1]?.order??order+20);
 return {zone,parentId:pages.find(p=>p.path===parent(target.path)&&p.path!=='/')?.id||null,order:(order+neighbor)/2,label:`${target.name} ${zone==='before'?'위':'아래'}로 이동`};
}
