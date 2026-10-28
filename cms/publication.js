const koreaDate=value=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function publicationDay(post){return post.displayDate|| (post.publishedAt?koreaDate(post.publishedAt):'')}
export function isNewPost(post,now=new Date()){if(post.status!=='published'||!post.publishedAt)return false;const day=publicationDay(post);if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return false;const age=(Date.parse(koreaDate(now)+'T00:00:00Z')-Date.parse(day+'T00:00:00Z'))/86400000;return age>=0&&age<=7}
export const newBadge=post=>isNewPost(post)?'<span class="column-new-badge" aria-label="최근 7일 이내 발행">NEW</span>':'';
