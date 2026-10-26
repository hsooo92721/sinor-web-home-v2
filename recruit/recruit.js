(()=>{
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const tabs=[...document.querySelectorAll('[data-benefit]')],panels=[...document.querySelectorAll('[role="tabpanel"]')];
 const benefitList=document.querySelector('.benefit-tabs'),benefitPanels=document.querySelector('.benefit-panels'),mobileBenefits=matchMedia('(max-width:760px)');
 let selectedBenefit=0;
 function selectBenefit(index){
  selectedBenefit=index;
  tabs.forEach((tab,i)=>{
   const open=i===index;
   if(mobileBenefits.matches){tab.removeAttribute('aria-selected');tab.setAttribute('aria-expanded',String(open));tab.tabIndex=0;}
   else{tab.removeAttribute('aria-expanded');tab.setAttribute('aria-selected',String(open));tab.tabIndex=open?0:-1;}
   panels[i].hidden=!open;panels[i].classList.remove('panel-enter');
   if(open&&!mobileBenefits.matches&&!reduce.matches)requestAnimationFrame(()=>panels[i].classList.add('panel-enter'));
  });
 }
 function layoutBenefits(){
  const mobile=mobileBenefits.matches;
  if(mobile)benefitList.removeAttribute('role');else benefitList.setAttribute('role','tablist');
  tabs.forEach((tab,i)=>{
   tab.setAttribute('role',mobile?'button':'tab');
   panels[i].setAttribute('role',mobile?'region':'tabpanel');
   if(mobile){tab.after(panels[i]);panels[i].removeAttribute('tabindex');}
   else{benefitPanels.append(panels[i]);panels[i].tabIndex=0;}
  });
  if(!mobile&&selectedBenefit<0)selectedBenefit=0;
  selectBenefit(selectedBenefit);
 }
 tabs.forEach((tab,i)=>{
  tab.addEventListener('click',()=>selectBenefit(mobileBenefits.matches&&selectedBenefit===i?-1:i));
  tab.addEventListener('keydown',e=>{
   if(mobileBenefits.matches)return;
   let next;if(e.key==='ArrowDown'||e.key==='ArrowRight')next=(i+1)%tabs.length;else if(e.key==='ArrowUp'||e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;
   e.preventDefault();selectBenefit(next);tabs[next].focus();
  });
 });
 mobileBenefits.addEventListener('change',layoutBenefits);layoutBenefits();
 const filters=[...document.querySelectorAll('[data-filter]')],roles=[...document.querySelectorAll('[data-job]')];filters.forEach(button=>button.addEventListener('click',()=>{filters.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));roles.forEach(row=>row.hidden=button.dataset.filter!=='전체'&&row.dataset.category!==button.dataset.filter);}));
 const dialog=document.querySelector('#jobDialog');let jobsPromise,opener;
 const getJobs=()=>jobsPromise||(jobsPromise=fetch('jobs-data.json').then(r=>{if(!r.ok)throw Error('직무 정보를 불러오지 못했습니다.');return r.json()}).catch(error=>{jobsPromise=null;throw error}));
 roles.forEach(row=>row.addEventListener('click',async()=>{if(row.dataset.loading)return;row.dataset.loading='true';row.setAttribute('aria-busy','true');try{const jobs=await getJobs(),job=jobs.find(j=>j.id===row.dataset.job);if(!job)throw Error('포지션을 찾지 못했습니다.');document.querySelector('#jobTitle').textContent=job.title;document.querySelector('#jobMeta').textContent=job.category+' · '+job.experience;const content=document.querySelector('#jobContent');content.replaceChildren();for(const group of job.sections){const section=document.createElement('section');section.className='job-section';const h=document.createElement('h3');h.textContent=group.heading;section.append(h);const list=document.createElement('ul');for(const text of group.items){const li=document.createElement('li');if(group.heading==='채용 프로세스'){li.className='job-process';text.split(/[▶▷→][\uFE0E\uFE0F]?/u).map(v=>v.trim()).filter(Boolean).forEach((step,i)=>{if(i){const arrow=document.createElement('i');arrow.className='fa-solid fa-chevron-right';arrow.setAttribute('aria-hidden','true');li.append(arrow);}const span=document.createElement('span');span.textContent=step;li.append(span);});}else li.textContent=text;list.append(li);}section.append(list);content.append(section);}document.querySelector('#jobContact').href='mailto:help@sinor.co.kr?subject='+encodeURIComponent('[시놀 채용 문의] '+job.title);opener=row;dialog.showModal();dialog.querySelector('.job-dialog-shell').scrollTop=0;document.documentElement.style.overflow='hidden';}catch(error){let feedback=document.querySelector('#jobLoadError');if(!feedback){feedback=document.createElement('p');feedback.id='jobLoadError';feedback.setAttribute('role','alert');row.after(feedback);}feedback.textContent=error.message+' 다시 눌러주세요.';}finally{delete row.dataset.loading;row.removeAttribute('aria-busy');}}));
 document.querySelector('.job-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});dialog.addEventListener('close',()=>{document.documentElement.style.overflow='';opener?.focus({preventScroll:true});});
 if(!reduce.matches&&'IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target);}},{threshold:.08,rootMargin:'0px 0px -25px 0px'});document.querySelectorAll('[data-motion]').forEach(el=>{el.classList.add('motion-ready');const peers=[...el.parentElement.children].filter(n=>n.hasAttribute('data-motion'));el.style.setProperty('--motion-delay',Math.min(peers.indexOf(el),3)*90+'ms');observer.observe(el)});document.addEventListener('focusin',e=>e.target.closest('[data-motion]')?.classList.add('is-visible'));reduce.addEventListener('change',e=>{if(e.matches){observer.disconnect();document.querySelectorAll('.motion-ready').forEach(el=>el.classList.add('is-visible'));}});}
 const track=document.querySelector('.career-hero-track'),hero=track.querySelector('.career-hero'),intro=hero.querySelector('.career-hero-copy'),story=hero.querySelector('.career-story-copy'),lines=[...story.querySelectorAll('.story-line')];
 const clamp=n=>Math.max(0,Math.min(1,n));
 if(!reduce.matches)document.body.classList.add('has-scroll-story');
 function updateHero(){if(reduce.matches){document.body.classList.remove('has-scroll-story');intro.inert=false;intro.removeAttribute('aria-hidden');story.setAttribute('aria-hidden','true');return;}const header=parseFloat(getComputedStyle(document.body).getPropertyValue('--career-header-height'))||88;const progress=clamp((header-track.getBoundingClientRect().top)/Math.max(1,track.offsetHeight-hero.offsetHeight));const first=1-clamp(progress/.27);hero.style.setProperty('--intro-alpha',first);hero.style.setProperty('--intro-y',(-progress*80)+'px');hero.style.setProperty('--hero-scale',1.06-progress*.06);hero.style.setProperty('--story-alpha',clamp((progress-.24)/.13));hero.style.setProperty('--last-alpha',clamp((progress-.7)/.18));lines.forEach((line,i)=>{const a=clamp((progress-(.29+i*.13))/.19);line.style.setProperty('--line-alpha',a);line.style.setProperty('--line-y',((1-a)*20)+'px');});intro.inert=first<.1;intro.setAttribute('aria-hidden',String(first<.1));story.setAttribute('aria-hidden',String(progress<.27));}
 reduce.addEventListener('change',()=>{if(!reduce.matches)document.body.classList.add('has-scroll-story');updateHero();});
 const top=document.querySelector('#careerTop'),footer=document.querySelector('.company-common-footer');let ticking=false;
 function update(){ticking=false;updateHero();const y=scrollY;document.body.classList.toggle('has-scrolled',y>120);document.body.classList.toggle('is-compact',y>420);top.hidden=y<=120;top.tabIndex=y>120?0:-1;top.parentElement.style.bottom=(24+Math.max(0,innerHeight-footer.getBoundingClientRect().top))+'px';}
 const schedule=()=>{if(!ticking){ticking=true;requestAnimationFrame(update)}};window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);top.addEventListener('click',()=>window.scrollTo({top:0,behavior:reduce.matches?'instant':'smooth'}));update();
})();
