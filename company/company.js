(()=>{
 const legacy={social:'social/',history:'history/',partners:'social/#partners',news:'news/'};
 const hash=location.hash.slice(1);if(document.body.classList.contains('page-overview')&&legacy[hash]){location.replace(new URL(legacy[hash],document.baseURI).href);return;}
 if(document.querySelector('#newsYear')){

 const year=document.querySelector('#newsYear'),search=document.querySelector('#newsSearch'),items=[...document.querySelectorAll('.news-item')],count=document.querySelector('#newsCount'),pager=document.querySelector('#newsPagination'),empty=document.querySelector('#newsEmpty');
 const pageSize=8;let page=1,filtered=items;
 function render(moveFocus=false){
  const pages=Math.ceil(filtered.length/pageSize);page=Math.max(1,Math.min(page,pages||1));items.forEach(item=>item.hidden=true);filtered.slice((page-1)*pageSize,page*pageSize).forEach(item=>item.hidden=false);
  count.textContent=filtered.length+'건';empty.hidden=filtered.length!==0;pager.replaceChildren();pager.hidden=pages<=1;
  const add=(label,number,{disabled=false,current=false,icon=''}={})=>{const b=document.createElement('button');b.type='button';b.className='page-btn';b.disabled=disabled;b.setAttribute('aria-label',label);b.setAttribute('aria-controls','newsResults');if(current)b.setAttribute('aria-current','page');if(icon){const i=document.createElement('i');i.className='fa-solid '+icon;i.setAttribute('aria-hidden','true');b.append(i);}else b.textContent=number;b.addEventListener('click',()=>{page=number;render(true)});pager.append(b);};
  if(pages>1){add('이전 페이지',page-1,{disabled:page===1,icon:'fa-chevron-left'});const start=Math.floor((page-1)/5)*5+1;for(let n=start;n<=Math.min(start+4,pages);n++)add(n+'페이지',n,{current:n===page});add('다음 페이지',page+1,{disabled:page===pages,icon:'fa-chevron-right'});}
  if(moveFocus){const top=document.querySelector('.news-tools');top.scrollIntoView({block:'start',behavior:'instant'});pager.querySelector('[aria-current="page"]')?.focus({preventScroll:true});}
 }
 function filter(){const term=search.value.trim().toLocaleLowerCase();filtered=items.filter(item=>(year.value==='all'||year.value===item.dataset.year)&&item.textContent.toLocaleLowerCase().includes(term));page=1;render();}
 year.addEventListener('change',filter);search.addEventListener('input',filter);filter();
 }
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 // Directional, one-time reveals are scoped to content, never navigation or controls.
 if(!reduce.matches&&'IntersectionObserver'in window){
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;entry.target.classList.add('is-revealed');observer.unobserve(entry.target);}},{threshold:.08,rootMargin:'0px 0px -35px 0px'});
  const assigned=new Set();
  function reveal(selector,direction,stagger=false){document.querySelectorAll(selector).forEach((el,i)=>{if(assigned.has(el))return;assigned.add(el);el.classList.add('scroll-reveal');el.dataset.reveal=direction==='alternate'?(i%2?'right':'left'):direction;el.style.setProperty('--reveal-delay',stagger?(i%3)*80+'ms':'0ms');const rect=el.getBoundingClientRect();if(rect.width&&rect.bottom<=0){el.classList.add('is-revealed');return;}observer.observe(el);});}
  reveal('.story-content>h2','left');reveal('.story-detail','right');
  reveal('.section-heading','up');reveal('.section-label,.section-description','fade');
  reveal('.service','alternate',true);
  reveal('.brand-logo','left');reveal('.brand-layout>div:not(.brand-logo)','right');
  reveal('.social-collaborators','fade');reveal('.social-photos img','up',true);
  reveal('.partner-logo','up',true);reveal('.partner-names','fade');
  reveal('.award-mark','left');reveal('.award-inner>div:not(.award-mark)','right');
  reveal('.timeline-month','up');
  reveal('.news-item','up',true);
  reveal('.contact h2,.contact .eyebrow,.contact .button','up',true);
  // Keyboard navigation and changes to motion preferences must never hide content.
  document.addEventListener('focusin',e=>{const el=e.target.closest('.scroll-reveal');if(el){el.classList.add('is-revealed');observer.unobserve(el);}});
  reduce.addEventListener('change',e=>{if(e.matches){observer.disconnect();document.querySelectorAll('.scroll-reveal').forEach(el=>el.classList.add('is-revealed'));}});
 }
 // Progress is tied to the reading position, not a timed animation.
 const timeline=document.querySelector('.history-timeline');
 const timelineYears=timeline?[...timeline.querySelectorAll('.timeline-year')]:[];
 function updateTimeline(){
  if(!timeline)return;
  const guide=Math.min(innerHeight*.44,340);
  for(const year of timelineYears){
   if(!year.open){year.style.setProperty('--timeline-fill','0px');year.classList.remove('is-reading','is-passed');continue;}
   const events=year.querySelector('.timeline-events'),rect=events.getBoundingClientRect();
   const filled=Math.max(0,Math.min(rect.height,guide-rect.top));
   events.style.setProperty('--timeline-fill',filled+'px');
   year.classList.toggle('is-reading',filled>0&&filled<rect.height);
   year.classList.toggle('is-passed',filled>=rect.height);
  }
 }
 if(timeline){
  timelineYears.forEach(year=>year.addEventListener('toggle',()=>requestAnimationFrame(updateTimeline)));
  if('ResizeObserver'in window){const sizes=new ResizeObserver(()=>requestAnimationFrame(updateTimeline));sizes.observe(timeline);}
 }
 const top=document.querySelector('#companyTop'),group=top.parentElement,footer=document.querySelector('.company-common-footer');let scheduled=false;
 function update(){scheduled=false;updateTimeline();const y=window.scrollY;document.body.classList.toggle('has-scrolled',y>120);document.body.classList.toggle('is-compact',y>420);top.hidden=y<=120;top.tabIndex=y>120?0:-1;group.style.bottom=(24+Math.max(0,innerHeight-footer.getBoundingClientRect().top))+'px';}
 function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(update)}}
 top.addEventListener('click',()=>window.scrollTo({top:0,behavior:reduce.matches?'instant':'smooth'}));window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);update();
})();
