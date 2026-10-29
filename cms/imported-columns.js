let imported;
export function importedColumns(){return imported??=fetch(new URL('imported-columns.json?v=1',import.meta.url),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('이전 칼럼을 불러오지 못했습니다.');return r.json()}).catch(e=>{imported=null;throw e})}
export function mergeImported(imported,local){const map=new Map(imported.map(p=>[p.id,p]));for(const p of local)map.set(p.id,p);return [...map.values()]}

export function mergeImportedAuthors(imported,local){return mergeImported(imported.filter(a=>!local.some(existing=>existing.name.trim()===a.name.trim())),local)}
