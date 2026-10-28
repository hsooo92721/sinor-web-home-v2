const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function categoryColor(category){const color=String(category?.color||'');return /^#[a-f\d]{6}$/i.test(color)?color.toLowerCase():'#2871e9'}
export function categoryBackground(category){const color=categoryColor(category);return '#'+[1,3,5].map(offset=>Math.round(parseInt(color.slice(offset,offset+2),16)*.08+255*.92).toString(16).padStart(2,'0')).join('')}
export function renderCategoryChip(category){return `<span class="column-category-chip" style="--category-color:${categoryColor(category)};--category-bg:${categoryBackground(category)}"><span class="column-category-dot" aria-hidden="true"></span>${E(category?.name||'시놀칼럼')}</span>`}
