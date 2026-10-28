"""Record source URLs + public titles/summaries without importing/publishing posts."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse,parse_qs
from datetime import datetime,timezone,timedelta
import concurrent.futures,subprocess,hashlib,json,re,csv,io,argparse
root=Path(__file__).resolve().parent.parent;args=argparse.ArgumentParser();args.add_argument('--manifest',default=str(root/'deployment/redirects/manifest.json'));args.add_argument('--no-fetch',action='store_true');options=args.parse_args();manifest=json.loads(Path(options.manifest).read_text());inventory=json.loads((root/'deployment/redirects/legacy-inventory.json').read_text());cache=Path('/tmp/sinor-legacy-url-reference');cache.mkdir(exist_ok=True)
class Meta(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.title=[];self.description='';self.headings=[];self.capture=None;self.parts=[];self.skip=0
 def handle_starttag(self,t,a):
  d=dict(a)
  if t=='meta' and (d.get('name')=='description' or d.get('property')=='og:description') and not self.description:self.description=d.get('content','')
  if t in ['script','style']:self.skip+=1
  if t=='title':self.capture='title';self.parts=[]
  if t in ['h1','h2','h3','h4'] and len(self.headings)<8:self.capture=t;self.parts=[]
 def handle_endtag(self,t):
  if t in ['script','style'] and self.skip:self.skip-=1
  if t==self.capture:
   text=' '.join(''.join(self.parts).split())
   if t=='title':self.title.append(text)
   elif text:self.headings.append(text)
   self.capture=None;self.parts=[]
 def handle_data(self,data):
  if self.capture and not self.skip:self.parts.append(data)
def clean(value):return ' '.join(re.sub('<[^>]*>',' ',str(value)).split())
def target(entry):
 u=urlparse(entry['sourceUrl']);params=parse_qs(u.query)
 for rule in manifest.get('columns',[]):
  source=urlparse(rule['sourceUrl'])
  if source.path.rstrip('/')==u.path.rstrip('/') and (str(rule.get('sourceId'))==params.get('idx',[''])[0] if rule.get('sourceId') else source.query==u.query):return rule['targetPath']
 if entry['kind']=='column':return None
 return next((r['targetPath'] for r in manifest['pages'] if r['sourcePath'].rstrip('/')==u.path.rstrip('/')),None)
def record(entry):
 url=entry['sourceUrl'];key=hashlib.sha256(url.encode()).hexdigest();file=cache/(key+'.json')
 if file.exists():response=json.loads(file.read_text())
 elif options.no_fetch:response={'status':0,'finalUrl':url,'html':'','error':'no cached response'}
 else:
  response=None
  for attempt in range(2):
   result=subprocess.run(['curl','-L','-s','--max-time','40','-w','\n__SINOR_META__%{http_code} %{url_effective}',url],capture_output=True)
   raw=result.stdout.decode('utf-8',errors='replace');html,_,meta=raw.rpartition('\n__SINOR_META__');status,_,final=meta.partition(' ');response={'status':int(status) if status.isdigit() else 0,'finalUrl':final or url,'html':html,'error':result.stderr.decode(errors='replace')[:200]}
   if 200<=response['status']<400:break
  file.write_text(json.dumps(response,ensure_ascii=False))
 parser=Meta();parser.feed(response['html']);title=entry.get('title') or next(iter(parser.title),'') or urlparse(url).path;description=clean(parser.description);headings=[clean(h) for h in parser.headings if clean(h)!=title and (clean(h)!='국내여행 특별약관' or 'domestic-special-terms' in url)];summary=description
 if entry['kind']=='page':
  if description.startswith('50+의 액티브 라이프를 위한 소셜 커뮤니티'):description=''
  summary=' / '.join(headings[:4])+(' — '+description if description else '')
  if not summary:summary=title+' 페이지 (공개 페이지 제목 기준)'
 if not summary:summary=' / '.join(headings[:4]) or '제목 외의 내용을 확인하지 못했습니다.'
 summary=summary.replace(title,'',1).strip(' —·:/')[:240]
 if response['status']>=400 or not response['status']:summary='현재 접속 오류로 본문 확인 불가. '+summary
 destination=target(entry)
 return {'kind':entry['kind'],'sourceUrl':url,'title':title,'summary':summary,'headings':headings[:8],'targetPath':destination,'targetUrl':manifest['canonicalOrigin']+destination if destination else '', 'mappingStatus':'연결 규칙 준비' if destination else '새 페이지 연결 필요','httpStatus':response['status'],'finalSourceUrl':response['finalUrl'],'checkedAt':datetime.now(timezone(timedelta(hours=9))).isoformat(timespec='seconds')}
rows=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for index,row in enumerate(pool.map(record,inventory['entries'])):
  rows.append(row)
  if (index+1)%25==0:print('URL reference',index+1,'/',len(inventory['entries']),flush=True)
folder=root/'deployment/redirects';(folder/'legacy-url-reference.json').write_text(json.dumps({'purpose':'원래 URL이 가리키던 공개 내용의 간략 백업. 전체 본문 백업은 아님.','checkedAt':'2026-10-28','entries':rows},ensure_ascii=False,indent=2)+'\n');fields=[('sourceUrl','기존 주소'),('title','원래 페이지 제목'),('summary','원래 내용 요약'),('targetUrl','새 주소'),('mappingStatus','연결 상태'),('httpStatus','기존 주소 응답'),('checkedAt','확인 시각')];buffer=io.StringIO();writer=csv.writer(buffer);writer.writerow([label for key,label in fields]);writer.writerows([[str(row.get(key,'')) for key,label in fields] for row in rows]);(folder/'legacy-url-reference.csv').write_text(buffer.getvalue(),encoding='utf-8-sig');escape=lambda value:str(value or '').replace('|','\\|').replace('\n',' ')
lines=['# 시놀 기존 URL · 원래 내용 대응표','','확인 기준: 2026-10-28 (한국시간). 원래 공개 페이지의 제목/설명/주요 제목을 요약했습니다. **전체 본문 백업은 아닙니다.** 미연결 주소는 운영 전 대응 페이지 또는 아카이브가 필요합니다.','','총 '+str(len(rows))+'개 주소 · 연결 규칙 준비 '+str(sum(bool(r['targetPath']) for r in rows))+'개 · 미연결 '+str(sum(not r['targetPath'] for r in rows))+'개','','| 기존 주소 | 원래 제목 | 원래 내용 요약 | 새 주소 | 연결 상태 |','|---|---|---|---|---|']
for row in rows:lines.append('| '+' | '.join(escape(row[key]) for key in ['sourceUrl','title','summary','targetUrl','mappingStatus'])+' |')
(folder/'legacy-url-reference.md').write_text('\n'.join(lines)+'\n');print('SAVED',len(rows),'URLs;',sum(200<=r['httpStatus']<400 for r in rows),'reachable;',sum(r['httpStatus']>=400 or not r['httpStatus'] for r in rows),'need source review',flush=True)
