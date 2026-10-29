// Reads archived public source only and fills the migrated article metadata locally.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('/Users/sinor/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'migration/columns/batch-05-20261029');
(async()=>{const data=JSON.parse(fs.readFileSync(path.join(root,'cms/imported-columns.json'))),report=JSON.parse(fs.readFileSync(path.join(folder,'report.json')));const browser=await chromium.launch({executablePath:'/Users/sinor/Library/Caches/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-mac-arm64/chrome-headless-shell'}),page=await browser.newPage();
for(const post of data.posts.slice(100)){const raw=fs.readFileSync(path.join(folder,'originals',post.sourceId+'.html'),'utf8');const meta=await page.evaluate(raw=>{const d=new DOMParser().parseFromString(raw,'text/html');return {bio:d.querySelector('.sinor-column-author-description')?.textContent.trim()||'',minutes:d.querySelector('.sinor-column-meta')?.textContent.match(/(?:시간\s*|약\s*)?(\d+)\s*분/)?.[1],hero:d.querySelector('.sinor-column-hero img')?.getAttribute('src')||'',avatar:d.querySelector('.sinor-column-author img')?.getAttribute('src')||''}},raw);
if(['167113110','167194260'].includes(post.sourceId)){const author=data.authors.find(a=>a.name==='양은미');post.author=author.name;post.authorId=author.id;post.authorProfile={...author}}
const a=post.authorProfile;if(a.name==='황규만'){a.affiliation='한국컨택센터산업협회';a.position='부회장'}if(['시놀','시놀트립'].includes(a.name)){a.affiliation='시놀(주)';a.position='에디터'}if(meta.bio)a.bio=meta.bio;if(meta.minutes)post.readMinutes=Number(meta.minutes);
for(const [key,url] of [['thumbnail',meta.hero],['image',meta.avatar]]){const image=report.images.find(i=>i.sourceUrl===url);if(image){if(key==='image')a.image=image.path;else post.thumbnail=image.path}}
const existing=data.authors.findIndex(author=>author.id===a.id);if(existing<0)data.authors.push({...a});else{const old=data.authors[existing];data.authors[existing]={...old,...a,bio:(old.bio||'').length>(a.bio||'').length?old.bio:a.bio}}
const row=report.posts.find(r=>r.sourceUrl===post.migration.sourceUrl);row.author=post.author;
}
// All new articles share the same saved author profile.
for(const post of data.posts.slice(100))post.authorProfile={...data.authors.find(a=>a.id===post.authorId)};
await browser.close();fs.writeFileSync(path.join(root,'cms/imported-columns.json'),JSON.stringify(data,null,2)+'\n');fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('Metadata connected:',data.posts.length-100,'articles');
})().catch(e=>{console.error(e);process.exit(1)});
