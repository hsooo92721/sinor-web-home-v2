(()=>{
 const legacy={social:'social/',history:'history/',partners:'social/#partners',news:'news/'};
 const hash=location.hash.slice(1);if(document.body.classList.contains('page-overview')&&legacy[hash]){location.replace(new URL(legacy[hash],document.baseURI).href);return;}
 if(document.querySelector('#newsYear')){

 let items=[...document.querySelectorAll('.news-item')];
 const year=document.querySelector('#newsYear'),search=document.querySelector('#newsSearch'),count=document.querySelector('#newsCount'),pager=document.querySelector('#newsPagination'),empty=document.querySelector('#newsEmpty');
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
 function dateKey(item){return item.date.map(n=>String(n).padStart(2,'0')).join('-')+'T'+(item.publishedAt||'');}
 async function loadNews(){
  // Scheduled GITHUB_TOKEN commits do not rebuild legacy GitHub Pages. Read the
  // public repository feed there; a company deployment uses its own relative feed.
  const githubPreview=location.hostname==='hsooo92721.github.io'&&location.pathname.startsWith('/sinor-web-home-v2/');
  const feed=githubPreview?'https://raw.githubusercontent.com/hsooo92721/sinor-web-home-v2/main/company/news-data.json':new URL('news-data.json',document.baseURI).href;
  try{
   const response=await fetch(feed,{cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw new Error('News data unavailable');
   const data=await response.json();if(!Array.isArray(data)||!data.length)throw new Error('Invalid news data');
   const records=data.filter(item=>item.editorialHidden!==true).map(item=>{
    if(typeof item.title!=='string'||!item.title.trim()||typeof item.meta!=='string'||!Array.isArray(item.date)||item.date.length!==3||!item.date.every(Number.isInteger))throw new Error('Invalid article');
    const [y,m,d]=item.date;const checked=new Date(Date.UTC(y,m-1,d));
    if(checked.getUTCFullYear()!==y||checked.getUTCMonth()!==m-1||checked.getUTCDate()!==d)throw new Error('Invalid article date');
    const url=new URL(item.url);if(!['https:','http:'].includes(url.protocol))throw new Error('Invalid article URL');
    return {...item,url:url.href,year:String(y)};
   }).sort((a,b)=>dateKey(b).localeCompare(dateKey(a)));
   const fragment=document.createDocumentFragment();
   const nextItems=records.map(item=>{
    const a=document.createElement('a');a.className='news-item';a.dataset.year=item.year;a.dataset.date=item.date.join('-');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label',item.title);
    const img=document.createElement('img');img.className='news-thumb';img.alt='';img.loading='lazy';img.decoding='async';img.width=640;img.height=346;
    // Only local article thumbnails; API results without an image use the shared placeholder.
    img.src=typeof item.image==='string'&&/^assets\/[a-zA-Z0-9_./-]+$/.test(item.image)&&!item.image.includes('..')?item.image:'assets/news-placeholder.svg';
    if(githubPreview)img.src=new URL(item.image||'assets/news-placeholder.svg','https://raw.githubusercontent.com/hsooo92721/sinor-web-home-v2/main/company/').href;
    img.addEventListener('error',()=>{img.src='assets/news-placeholder.svg'},{once:true});
    const meta=document.createElement('span');meta.className='news-meta';meta.textContent=item.meta;
    const title=document.createElement('h3');title.textContent=item.title;
    a.append(img,meta,title);fragment.append(a);return a;
   });
   const chosenYear=year.value;const years=[...new Set(records.map(item=>item.year))].sort((a,b)=>Number(b)-Number(a));
   const all=document.createElement('option');all.value='all';all.textContent='전체 연도';year.replaceChildren(all);
   years.forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;year.append(option)});
   year.value=years.includes(chosenYear)?chosenYear:'all';
   document.querySelector('#newsResults').replaceChildren(fragment);items=nextItems;filter();
  }catch(error){console.warn('최신 기사 데이터를 불러오지 못해 저장된 목록을 표시합니다.');}
 }
 loadNews();

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
