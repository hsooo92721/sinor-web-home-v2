export const PAGE_SIZE=8;
export function paginationState(totalItems,page=1){
 if(!Number.isInteger(totalItems)||totalItems<0)throw new Error('totalItems must be a non-negative integer');
 const totalPages=Math.ceil(totalItems/PAGE_SIZE),current=totalPages?Math.min(Math.max(Math.trunc(page)||1,1),totalPages):1;
 const first=Math.floor((current-1)/5)*5+1;
 return {page:current,totalPages,offset:(current-1)*PAGE_SIZE,limit:PAGE_SIZE,pages:Array.from({length:Math.min(5,Math.max(0,totalPages-first+1))},(_,i)=>first+i),hasPrevious:totalPages>0&&current>1,hasNext:current<totalPages};
}
export function createPagination(host,onChange){
 function render(totalItems,page){const state=paginationState(totalItems,page);host.replaceChildren();host.setAttribute('aria-label','새로 개설된 모임 페이지');
 const make=(name,label,to,disabled=false,current=false)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',label);button.disabled=disabled;if(current)button.setAttribute('aria-current','page');if(typeof name==='string')button.textContent=name;else{const icon=document.createElement('i');icon.className='fa-solid '+name.icon;icon.setAttribute('aria-hidden','true');button.append(icon);}button.onclick=()=>onChange(to);return button;};
 if(!state.totalPages)return state;
 host.append(make({icon:'fa-chevron-left'},'이전 페이지',state.page-1,!state.hasPrevious));
 for(const p of state.pages)host.append(make(String(p),p+'페이지',p,false,p===state.page));
 host.append(make({icon:'fa-chevron-right'},'다음 페이지',state.page+1,!state.hasNext));return state;}
 return {render};
}
