"""Collect URL/title inventory only. Does not import article bodies or publish posts."""
from pathlib import Path
import re,json,subprocess,sys
from html.parser import HTMLParser
from urllib.parse import urlparse,parse_qs,urljoin
root=Path(__file__).resolve().parent.parent
fetch=lambda url:subprocess.check_output(['curl','--fail','-L','-s','--max-time','40',url]).decode('utf-8')
manifest=json.loads((root/'deployment/redirects/manifest.json').read_text());mapping={r['sourcePath']:r['targetPath'] for r in manifest['pages']};sitemap=fetch('https://sinor.co.kr/sitemap.xml');urls=re.findall(r'<loc>(.*?)</loc>',sitemap)
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.id=None;self.title=False;self.depth=0;self.ignore=0;self.text=[];self.posts=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='a' and 'idx=' in a.get('href','') and not self.id:self.id=parse_qs(urlparse(a['href']).query).get('idx',[None])[0]
  if self.id and 'title' in a.get('class','').split() and not self.title:self.title=True;self.depth=1;self.text=[];return
  if self.title:
   self.depth+=1
   if tag=='span':self.ignore+=1
 def handle_endtag(self,tag):
  if self.title:
   self.depth-=1
   if tag=='span' and self.ignore:self.ignore-=1
   if self.depth==0:self.title=False;title=' '.join(''.join(self.text).split()).removeprefix('공지 ');self.posts.append({'sourceId':self.id,'title':title,'sourceUrl':'https://sinor.co.kr/information/?bmode=view&idx='+self.id});self.id=None
  elif tag=='a':self.id=None
 def handle_data(self,data):
  if self.title and not self.ignore:self.text.append(data)
posts={}
for page in range(1,101):
 html=fetch('https://sinor.co.kr/information/?page='+str(page));parser=Parser();parser.feed(html);new=[p for p in parser.posts if p['sourceId'] not in posts]
 if not new:break
 for p in new:posts[p['sourceId']]=p
 print('URL inventory page',page,'new',len(new),flush=True)
 if not re.search(r'page='+str(page+1)+r'(?:[\"\'&])',html):break
entries=[{'sourceUrl':url,'kind':'page','targetPath':mapping.get(urlparse(url).path),'state':'mapped' if urlparse(url).path in mapping else 'needs_mapping'} for url in urls]
entries +=[{'sourceUrl':p['sourceUrl'],'kind':'column','title':p['title'],'targetPath':None,'state':'not_imported'} for p in posts.values()]
(root/'deployment/redirects/legacy-inventory.json').write_text(json.dumps({'source':'https://sinor.co.kr/sitemap.xml','checkedAt':'2026-10-28','entries':entries},ensure_ascii=False,indent=2)+'\n');(root/'cms/legacy-column-index.json').write_text(json.dumps(list(posts.values()),ensure_ascii=False,indent=2)+'\n');print('Column URL/title index:',len(posts),flush=True)
