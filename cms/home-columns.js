import {cms,articleUrl,siteUrl,watch} from './client.js?v=21';
async function render(){
 const section=document.querySelector('.column-section');if(!section)return;
 const [posts,categories]=await Promise.all([cms.publicPosts(),cms.categories()]);
 const items=posts.slice(0,2);
 section.querySelectorAll('[data-column-card],.cms-column-empty').forEach(e=>e.remove());
 const more=section.querySelector('.section-head a');if(more)more.href=siteUrl('columns/');
 if(!items.length){const note=document.createElement('p');note.className='cms-column-empty';note.style.cssText='font-size:14px;line-height:1.7;color:#8b95a1;margin:8px 0';note.textContent='새로운 칼럼을 준비하고 있어요.';section.append(note)}
 items.forEach(p=>{const a=document.createElement('a');a.className='column-card';a.dataset.columnCard='';a.href=articleUrl(p.id);a.target='_blank';a.rel='noopener noreferrer';const cover=document.createElement('span');cover.className='column-thumb';cover.dataset.thumb='';if(p.thumbnail)cover.style.backgroundImage=`url("${p.thumbnail}")`;const row=document.createElement('span');row.className='column-body';const category=document.createElement('em');category.dataset.category='';category.textContent=categories.find(c=>c.id===p.categoryId)?.name||'칼럼';const title=document.createElement('strong');title.dataset.title='';title.textContent=p.title;const arrow=document.createElement('i');arrow.className='fa-solid fa-chevron-right arrow';arrow.setAttribute('aria-hidden','true');row.append(category,title,arrow);a.append(cover,row);section.append(a)});
 window.dispatchEvent(new Event('resize'));
}
render().catch(()=>{});watch(()=>render().catch(()=>{}));document.addEventListener('visibilitychange',()=>{if(!document.hidden)render().catch(()=>{})});
